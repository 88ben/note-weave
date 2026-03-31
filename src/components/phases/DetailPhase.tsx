import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '../../store/appStore'
import type { Chapter, ChapterOutline, Message, OutlineSection } from '../../../shared/types'

const SYSTEM_PROMPT = `You are an expert book editor creating a detailed chapter outline. Given the chapter information and source notes, create a comprehensive outline with sections, subsections (2-3 levels deep), key points (3-7 per section), source note references, and transitions. Respond in JSON: {"sections": [{"id": "...", "title": "...", "level": 1, "keyPoints": [...], "sourceNoteIds": [...], "transition": "...", "children": [...]}]}`

function stripCodeFences(raw: string): string {
  let t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (m) t = m[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return t
}

function normalizeSection(raw: unknown, depth = 1): OutlineSection {
  if (!raw || typeof raw !== 'object') {
    return {
      id: uuidv4(),
      title: 'Untitled section',
      level: depth,
      keyPoints: [],
      sourceNoteIds: [],
      children: []
    }
  }
  const o = raw as Record<string, unknown>
  const childRaw = Array.isArray(o.children) ? o.children : []
  return {
    id: typeof o.id === 'string' && o.id ? o.id : uuidv4(),
    title: typeof o.title === 'string' && o.title ? o.title : 'Untitled section',
    level: typeof o.level === 'number' && o.level >= 1 ? o.level : depth,
    keyPoints: Array.isArray(o.keyPoints)
      ? o.keyPoints.filter((x): x is string => typeof x === 'string')
      : [],
    sourceNoteIds: Array.isArray(o.sourceNoteIds)
      ? o.sourceNoteIds.filter((x): x is string => typeof x === 'string')
      : [],
    transition: typeof o.transition === 'string' && o.transition ? o.transition : undefined,
    children: childRaw.map((c) => normalizeSection(c, depth + 1))
  }
}

function parseSectionsFromAi(content: string): OutlineSection[] {
  const trimmed = stripCodeFences(content)
  const parsed = JSON.parse(trimmed) as { sections?: unknown }
  if (!parsed || !Array.isArray(parsed.sections)) {
    throw new Error('Response missing a "sections" array')
  }
  return parsed.sections.map((s) => normalizeSection(s, 1))
}

function cloneOutlines(outlines: ChapterOutline[]): ChapterOutline[] {
  return JSON.parse(JSON.stringify(outlines)) as ChapterOutline[]
}

function updateSectionAt(
  sections: OutlineSection[],
  sectionId: string,
  fn: (s: OutlineSection) => OutlineSection
): OutlineSection[] {
  return sections.map((s) => {
    if (s.id === sectionId) return fn(s)
    if (s.children.length) {
      return { ...s, children: updateSectionAt(s.children, sectionId, fn) }
    }
    return s
  })
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`transition-transform duration-200 ${open ? 'rotate-90' : ''} ${className ?? ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6.3 4.3L12.9 10l-6.6 5.7V4.3z" />
    </svg>
  )
}

function SectionTree({
  sections,
  depth,
  notesById,
  collapsedIds,
  toggleCollapsed,
  onTitleChange,
  onKeyPointChange,
  onAddKeyPoint,
  onRemoveKeyPoint,
  onTransitionChange
}: {
  sections: OutlineSection[]
  depth: number
  notesById: Map<string, { filename: string }>
  collapsedIds: Set<string>
  toggleCollapsed: (id: string) => void
  onTitleChange: (id: string, title: string) => void
  onKeyPointChange: (id: string, index: number, value: string) => void
  onAddKeyPoint: (id: string) => void
  onRemoveKeyPoint: (id: string, index: number) => void
  onTransitionChange: (id: string, transition: string) => void
}) {
  return (
    <ul className={depth === 0 ? 'space-y-2' : 'ml-4 mt-2 space-y-2 border-l border-border/80 pl-3'}>
      {sections.map((section) => {
        const hasChildren = section.children.length > 0
        const collapsed = collapsedIds.has(section.id)
        const showChildren = hasChildren && !collapsed

        return (
          <li key={section.id} className="rounded-lg border border-border/90 bg-surface shadow-sm">
            <div className="flex items-start gap-1 p-3">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleCollapsed(section.id)}
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? 'Expand section' : 'Collapse section'}
                >
                  <ChevronIcon open={!collapsed} className="h-4 w-4" />
                </button>
              ) : (
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center text-text-tertiary/50" aria-hidden>
                  ·
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => onTitleChange(section.id, e.target.value)}
                  className="w-full rounded-md border border-transparent bg-transparent text-sm font-semibold text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-border-focus focus:bg-surface-secondary focus:px-2 focus:py-1"
                  placeholder="Section title"
                />
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Key points</p>
                  <ul className="space-y-1">
                    {section.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                        <input
                          type="text"
                          value={point}
                          onChange={(e) => onKeyPointChange(section.id, i, e.target.value)}
                          className="min-w-0 flex-1 rounded-md border border-transparent bg-surface-tertiary/50 px-2 py-1 text-xs text-text-secondary outline-none focus:border-border-focus focus:bg-surface-secondary"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveKeyPoint(section.id, i)}
                          className="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-danger/80 hover:bg-danger/10 hover:text-danger"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => onAddKeyPoint(section.id)}
                    className="text-xs font-medium text-accent hover:text-accent-hover"
                  >
                    + Add key point
                  </button>
                </div>
                {section.sourceNoteIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Sources</span>
                    {section.sourceNoteIds.map((nid) => (
                      <span
                        key={nid}
                        className="max-w-[140px] truncate rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-medium text-accent"
                        title={notesById.get(nid)?.filename ?? nid}
                      >
                        {notesById.get(nid)?.filename ?? nid.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                )}
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Transition</p>
                  <textarea
                    value={section.transition ?? ''}
                    onChange={(e) => onTransitionChange(section.id, e.target.value)}
                    rows={2}
                    placeholder="Optional transition to the next section…"
                    className="w-full resize-y rounded-md border border-border bg-surface-secondary px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-border-focus"
                  />
                </div>
              </div>
            </div>
            {showChildren ? (
              <div className="border-t border-border/60 bg-surface-secondary/40 px-2 py-2">
                <SectionTree
                  sections={section.children}
                  depth={depth + 1}
                  notesById={notesById}
                  collapsedIds={collapsedIds}
                  toggleCollapsed={toggleCollapsed}
                  onTitleChange={onTitleChange}
                  onKeyPointChange={onKeyPointChange}
                  onAddKeyPoint={onAddKeyPoint}
                  onRemoveKeyPoint={onRemoveKeyPoint}
                  onTransitionChange={onTransitionChange}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function mergeChapterOutline(
  prev: ChapterOutline[],
  chapter: Chapter,
  sections: OutlineSection[]
): ChapterOutline[] {
  const idx = prev.findIndex((o) => o.chapterId === chapter.id)
  const outline: ChapterOutline = { chapterId: chapter.id, chapterTitle: chapter.title, sections }
  return idx < 0 ? [...prev, outline] : prev.map((o, i) => (i === idx ? outline : o))
}

function buildUserMessage(chapter: Chapter, notesContent: { id: string; filename: string; content: string }[]): string {
  const lines = [
    `Chapter title: ${chapter.title}`,
    `Chapter description: ${chapter.description}`,
    '',
    'Source notes:'
  ]
  for (const n of notesContent) {
    lines.push('', `### ${n.filename} (note id: ${n.id})`, n.content)
  }
  return lines.join('\n')
}

export function DetailPhase() {
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const notes = useAppStore((s) => s.notes)
  const settings = useAppStore((s) => s.settings)
  const phaseStructureData = useAppStore((s) => s.phaseStructureData)
  const phaseDetailData = useAppStore((s) => s.phaseDetailData)
  const savePhaseDetailData = useAppStore((s) => s.savePhaseDetailData)
  const setCurrentPhase = useAppStore((s) => s.setCurrentPhase)
  const setLoading = useAppStore((s) => s.setLoading)

  const [localOutlines, setLocalOutlines] = useState<ChapterOutline[]>([])
  const localOutlinesRef = useRef<ChapterOutline[]>([])
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    localOutlinesRef.current = localOutlines
  }, [localOutlines])

  const sortedChapters = useMemo(() => {
    if (!phaseStructureData?.chapters?.length) return []
    return [...phaseStructureData.chapters].sort((a, b) => a.order - b.order)
  }, [phaseStructureData])

  useEffect(() => {
    if (phaseDetailData?.chapterOutlines?.length) {
      const o = cloneOutlines(phaseDetailData.chapterOutlines)
      localOutlinesRef.current = o
      setLocalOutlines(o)
    } else {
      localOutlinesRef.current = []
      setLocalOutlines([])
    }
  }, [phaseDetailData, activeProjectId])

  const notesById = useMemo(() => {
    const m = new Map<string, { filename: string }>()
    for (const n of notes) m.set(n.id, { filename: n.filename })
    return m
  }, [notes])

  const getNotesForChapter = useCallback(
    (chapter: Chapter) => {
      const list: { id: string; filename: string; content: string }[] = []
      for (const id of chapter.noteIds) {
        const n = notes.find((x) => x.id === id)
        if (n) list.push({ id: n.id, filename: n.filename, content: n.content })
      }
      return list
    },
    [notes]
  )

  const runGenerationForChapter = useCallback(
    async (chapter: Chapter): Promise<OutlineSection[]> => {
      const notePayload = getNotesForChapter(chapter)
      const messages: Message[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(chapter, notePayload) }
      ]
      const res = await window.api.aiChat(messages, settings.aiProvider)
      return parseSectionsFromAi(res.content)
    },
    [getNotesForChapter, settings.aiProvider]
  )

  const generateAll = async () => {
    if (!sortedChapters.length || !settings.aiProvider.apiKey.trim()) {
      setError(
        !settings.aiProvider.apiKey.trim()
          ? 'Add an API key in Settings before generating outlines.'
          : 'No chapters found. Complete the Structure phase first.'
      )
      return
    }
    setError(null)
    setIsGenerating(true)
    const total = sortedChapters.length
    const next: ChapterOutline[] = []
    try {
      for (let i = 0; i < sortedChapters.length; i++) {
        const ch = sortedChapters[i]
        setLoading(true, `Generating outline for Chapter ${i + 1} of ${total}…`)
        const sections = await runGenerationForChapter(ch)
        next.push({
          chapterId: ch.id,
          chapterTitle: ch.title,
          sections
        })
        const copy = cloneOutlines(next)
        localOutlinesRef.current = copy
        setLocalOutlines(copy)
      }
      const finalOutlines = cloneOutlines(next)
      localOutlinesRef.current = finalOutlines
      setLocalOutlines(finalOutlines)
      await savePhaseDetailData({
        chapterOutlines: finalOutlines,
        approved: false,
        generatedAt: new Date().toISOString()
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed'
      setError(msg)
      const partial = cloneOutlines(next)
      localOutlinesRef.current = partial
      setLocalOutlines(partial)
    } finally {
      setLoading(false)
      setIsGenerating(false)
    }
  }

  const regenerateChapter = async (chapter: Chapter) => {
    if (!settings.aiProvider.apiKey.trim()) {
      setError('Add an API key in Settings before regenerating.')
      return
    }
    setError(null)
    setIsGenerating(true)
    try {
      setLoading(true, `Regenerating outline for “${chapter.title}”…`)
      const sections = await runGenerationForChapter(chapter)
      const merged = mergeChapterOutline(localOutlinesRef.current, chapter, sections)
      localOutlinesRef.current = merged
      setLocalOutlines(merged)
      await savePhaseDetailData({
        chapterOutlines: cloneOutlines(merged),
        approved: phaseDetailData?.approved ?? false,
        generatedAt: phaseDetailData?.generatedAt ?? new Date().toISOString()
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setLoading(false)
      setIsGenerating(false)
    }
  }

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const patchSection = useCallback((chapterId: string, sectionId: string, fn: (s: OutlineSection) => OutlineSection) => {
    setLocalOutlines((prev) =>
      prev.map((o) =>
        o.chapterId === chapterId ? { ...o, sections: updateSectionAt(o.sections, sectionId, fn) } : o
      )
    )
  }, [])

  const onTitleChange = (chapterId: string, sectionId: string, title: string) => {
    patchSection(chapterId, sectionId, (s) => ({ ...s, title }))
  }

  const onKeyPointChange = (chapterId: string, sectionId: string, index: number, value: string) => {
    patchSection(chapterId, sectionId, (s) => {
      const keyPoints = [...s.keyPoints]
      keyPoints[index] = value
      return { ...s, keyPoints }
    })
  }

  const onAddKeyPoint = (chapterId: string, sectionId: string) => {
    patchSection(chapterId, sectionId, (s) => ({ ...s, keyPoints: [...s.keyPoints, ''] }))
  }

  const onRemoveKeyPoint = (chapterId: string, sectionId: string, index: number) => {
    patchSection(chapterId, sectionId, (s) => ({
      ...s,
      keyPoints: s.keyPoints.filter((_, i) => i !== index)
    }))
  }

  const onTransitionChange = (chapterId: string, sectionId: string, transition: string) => {
    patchSection(chapterId, sectionId, (s) => ({
      ...s,
      transition: transition.trim() ? transition : undefined
    }))
  }

  const handleApprove = async () => {
    if (!localOutlines.length) return
    setError(null)
    try {
      setLoading(true, 'Saving outline…')
      const snapshot = cloneOutlines(localOutlines)
      localOutlinesRef.current = snapshot
      await savePhaseDetailData({
        chapterOutlines: snapshot,
        approved: true,
        generatedAt: phaseDetailData?.generatedAt ?? new Date().toISOString(),
        approvedAt: new Date().toISOString()
      })
      setCurrentPhase('export')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save outline')
    } finally {
      setLoading(false)
    }
  }

  const hasAnySections = localOutlines.some((o) => o.sections.length > 0)
  const canApprove = hasAnySections && !isGenerating

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-secondary via-surface to-accent-light/30 p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Phase 4</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">Detailed Outline</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Turn each chapter into a nested outline with key points, source references, and transitions. Generate with AI,
            refine inline, then approve to export.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void generateAll()}
              disabled={isGenerating || !sortedChapters.length}
              className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-accent/25 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? 'Generating…' : 'Generate Outlines'}
            </button>
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={!canApprove}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:border-accent/40 hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-45"
            >
              Approve &amp; Continue
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-text-primary"
          role="alert"
        >
          <span className="mt-0.5 font-semibold text-danger">Error</span>
          <p className="flex-1 text-text-secondary">{error}</p>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-xs font-medium text-danger hover:underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {!phaseStructureData?.chapters?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-secondary/80 px-6 py-12 text-center">
          <p className="text-sm font-medium text-text-primary">No chapter structure yet</p>
          <p className="mt-1 text-xs text-text-tertiary">Complete the Structure phase to define chapters, then return here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedChapters.map((chapter) => {
            const outline = localOutlines.find((o) => o.chapterId === chapter.id)
            return (
              <section
                key={chapter.id}
                className="rounded-2xl border border-border bg-surface-secondary/60 p-6 shadow-sm backdrop-blur-sm"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{chapter.title}</h3>
                    <p className="mt-1 text-sm text-text-secondary">{chapter.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void regenerateChapter(chapter)}
                    disabled={isGenerating}
                    className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/35 hover:text-accent disabled:opacity-50"
                  >
                    Re-generate Chapter
                  </button>
                </div>
                {outline?.sections.length ? (
                  <SectionTree
                    sections={outline.sections}
                    depth={0}
                    notesById={notesById}
                    collapsedIds={collapsedIds}
                    toggleCollapsed={toggleCollapsed}
                    onTitleChange={(id, t) => onTitleChange(chapter.id, id, t)}
                    onKeyPointChange={(id, i, v) => onKeyPointChange(chapter.id, id, i, v)}
                    onAddKeyPoint={(id) => onAddKeyPoint(chapter.id, id)}
                    onRemoveKeyPoint={(id, i) => onRemoveKeyPoint(chapter.id, id, i)}
                    onTransitionChange={(id, tr) => onTransitionChange(chapter.id, id, tr)}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-text-tertiary">
                    No outline for this chapter yet. Use &ldquo;Generate Outlines&rdquo; to build all chapters, or
                    &ldquo;Re-generate Chapter&rdquo; for this one only.
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
