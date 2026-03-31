import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Chapter, Message, PhaseClusterData, PhaseStructureData, ThemeCluster } from '../../../shared/types'
import { PhaseLayout, ProceedButton, AdjustButton, RedoIconButton, ConfirmModal } from './PhaseLayout'

const STRUCTURE_SYSTEM_PROMPT =
  'You are an expert book editor helping structure a book from organized note clusters. Propose a chapter structure with ordering, titles, descriptions, and which clusters map to each chapter. Respond in JSON: {"chapters": [{"id": "chapter-1", "title": "...", "description": "...", "order": 1, "clusterIds": [...], "noteIds": [...]}]}'

function parseAiJsonObject(raw: string): { chapters?: Chapter[] } {
  let s = raw.trim()
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im
  const m = s.match(fence)
  if (m) s = m[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  return JSON.parse(s) as { chapters?: Chapter[] }
}

function normalizeOrders(list: Chapter[]): Chapter[] {
  return list.map((c, i) => ({ ...c, order: i + 1 }))
}

function snippet(text: string, max = 100): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5"
      />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

export function StructurePhase() {
  const notes = useAppStore((s) => s.notes)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const settings = useAppStore((s) => s.settings)
  const phaseClusterData = useAppStore((s) => s.phaseClusterData)
  const phaseStructureData = useAppStore((s) => s.phaseStructureData)
  const savePhaseStructureData = useAppStore((s) => s.savePhaseStructureData)
  const setCurrentPhase = useAppStore((s) => s.setCurrentPhase)
  const setLoading = useAppStore((s) => s.setLoading)

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)

  useEffect(() => {
    if (phaseStructureData?.chapters?.length) {
      const sorted = [...phaseStructureData.chapters].sort((a, b) => a.order - b.order)
      setChapters(
        sorted.map((c) => ({
          ...c,
          clusterIds: [...c.clusterIds],
          noteIds: [...c.noteIds]
        }))
      )
      setGeneratedAt(phaseStructureData.generatedAt ?? null)
    } else {
      setChapters([])
      setGeneratedAt(null)
    }
  }, [phaseStructureData])

  const clusterPayload: PhaseClusterData | null = useMemo(() => {
    if (!phaseClusterData?.clusters?.length) return null
    return phaseClusterData
  }, [phaseClusterData])

  const clusterById = useMemo(() => {
    const m = new Map<string, ThemeCluster>()
    if (phaseClusterData?.clusters) {
      for (const c of phaseClusterData.clusters) m.set(c.id, c)
    }
    return m
  }, [phaseClusterData])

  const noteById = useMemo(() => {
    const m = new Map<string, (typeof notes)[0]>()
    for (const n of notes) m.set(n.id, n)
    return m
  }, [notes])

  const runStructure = useCallback(async () => {
    setError(null)
    if (!settings.aiProvider.apiKey.trim()) {
      setError('Add an API key in Settings to generate structure.')
      return
    }
    if (!clusterPayload) {
      setError('Complete the Cluster phase and save cluster data first.')
      return
    }

    const messages: Message[] = [
      { role: 'system', content: STRUCTURE_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(clusterPayload) }
    ]

    setLoading(true, 'Generating chapter structure…')
    try {
      const { content } = await window.api.aiChat(messages, settings.aiProvider)
      const parsed = parseAiJsonObject(content)
      const list = parsed.chapters
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('The model returned no chapters. Try again or switch models.')
      }
      const normalized: Chapter[] = list.map((ch, i) => ({
        id: typeof ch.id === 'string' && ch.id ? ch.id : `chapter-${i + 1}`,
        title: typeof ch.title === 'string' ? ch.title : `Chapter ${i + 1}`,
        description: typeof ch.description === 'string' ? ch.description : '',
        order: typeof ch.order === 'number' && Number.isFinite(ch.order) ? ch.order : i + 1,
        clusterIds: Array.isArray(ch.clusterIds)
          ? ch.clusterIds.filter((id): id is string => typeof id === 'string')
          : [],
        noteIds: Array.isArray(ch.noteIds) ? ch.noteIds.filter((id): id is string => typeof id === 'string') : []
      }))
      normalized.sort((a, b) => a.order - b.order)
      setChapters(normalizeOrders(normalized))
      setGeneratedAt(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Structure generation failed.')
    } finally {
      setLoading(false)
    }
  }, [clusterPayload, settings.aiProvider, setLoading])

  const updateChapter = useCallback((id: string, patch: Partial<Chapter>) => {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const moveChapter = useCallback((index: number, dir: -1 | 1) => {
    setChapters((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return normalizeOrders(next)
    })
  }, [])

  const addChapter = useCallback(() => {
    setChapters((prev) =>
      normalizeOrders([
        ...prev,
        {
          id: `chapter-new-${Date.now()}`,
          title: `New chapter ${prev.length + 1}`,
          description: '',
          order: prev.length + 1,
          clusterIds: [],
          noteIds: []
        }
      ])
    )
  }, [])

  const deleteChapter = useCallback((id: string) => {
    setChapters((prev) => normalizeOrders(prev.filter((c) => c.id !== id)))
  }, [])

  const handleApprove = useCallback(async () => {
    setError(null)
    if (chapters.length === 0) {
      setError('Add or generate at least one chapter before continuing.')
      return
    }
    const now = new Date().toISOString()
    const data: PhaseStructureData = {
      chapters: normalizeOrders(chapters),
      approved: true,
      generatedAt: generatedAt ?? now,
      approvedAt: now
    }
    try {
      await savePhaseStructureData(data)
      setCurrentPhase('detail')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save structure.')
    }
  }, [chapters, generatedAt, savePhaseStructureData, setCurrentPhase])

  const projectNotes = useMemo(
    () => notes.filter((n) => n.projectId === activeProjectId),
    [notes, activeProjectId]
  )

  return (
    <PhaseLayout
      phase="structure"
      title="Structure"
      description="Turn thematic clusters into an ordered chapter outline. Edit titles, reorder chapters, then approve to move on to detailed outlining."
      error={error}
      onDismissError={() => setError(null)}
      actions={
        <>
          <RedoIconButton
            onClick={() => {
              if (chapters.length > 0) { setConfirmRegen(true) } else { void runStructure() }
            }}
            disabled={!clusterPayload}
            title={chapters.length ? 'Re-generate structure' : 'Generate structure'}
          />
          <AdjustButton onClick={addChapter}>Add Chapter</AdjustButton>
          <ProceedButton onClick={() => void handleApprove()} disabled={chapters.length === 0}>
            Approve & Continue
          </ProceedButton>
        </>
      }
    >
      <ConfirmModal
        open={confirmRegen}
        title="Re-generate structure?"
        message="This will replace all existing chapters with new AI-generated ones. Your current chapter titles, descriptions, and ordering will be lost."
        confirmLabel="Re-generate"
        onConfirm={() => { setConfirmRegen(false); void runStructure() }}
        onCancel={() => setConfirmRegen(false)}
      />

      {!clusterPayload && (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-text-secondary">
          <span className="font-medium text-warning">No cluster data found.</span> Finish Phase 2 and approve clusters
          so structure generation has themes to work from.
        </div>
      )}

      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary/60 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent">
            <LayersIcon className="h-8 w-8" />
          </div>
          <p className="max-w-md text-sm text-text-secondary">
            Use <span className="font-medium text-text-primary">Generate Structure</span> to propose chapters from your
            clusters, or add chapters manually.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" aria-label="Chapters">
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <article className="overflow-hidden rounded-xl border border-border bg-surface-secondary transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-3 border-b border-border bg-surface-tertiary/40 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-sm">
                      {chapter.order}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        type="text"
                        value={chapter.title}
                        onChange={(e) => updateChapter(chapter.id, { title: e.target.value })}
                        className="w-full rounded-lg border border-transparent bg-surface px-2 py-1 text-base font-semibold text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                        aria-label={`Chapter ${chapter.order} title`}
                      />
                      <textarea
                        value={chapter.description}
                        onChange={(e) => updateChapter(chapter.id, { description: e.target.value })}
                        rows={6}
                        className="w-full max-h-48 resize-y rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-text-secondary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                        placeholder="What this chapter covers…"
                        aria-label="Chapter description"
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveChapter(index, -1)}
                      className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                      aria-label="Move chapter up"
                    >
                      <ChevronUpIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === chapters.length - 1}
                      onClick={() => moveChapter(index, 1)}
                      className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                      aria-label="Move chapter down"
                    >
                      <ChevronDownIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChapter(chapter.id)}
                      className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                      aria-label={`Delete chapter ${chapter.title}`}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                      Clusters
                    </h4>
                    {chapter.clusterIds.length === 0 ? (
                      <p className="text-xs text-text-tertiary">No clusters linked</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {chapter.clusterIds.map((cid) => {
                          const cl = clusterById.get(cid)
                          return (
                            <li
                              key={cid}
                              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                            >
                              <span className="font-medium">{cl?.name ?? cid}</span>
                              {cl?.description ? (
                                <p className="mt-0.5 text-xs text-text-tertiary">{snippet(cl.description, 140)}</p>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                      Notes ({chapter.noteIds.length})
                    </h4>
                    {chapter.noteIds.length === 0 ? (
                      <p className="text-xs text-text-tertiary">No notes listed for this chapter</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {chapter.noteIds.map((nid) => {
                          const note = noteById.get(nid)
                          const label =
                            note?.filename ??
                            projectNotes.find((n) => n.id === nid)?.filename ??
                            nid
                          const sum = note?.summary ?? note?.content ?? ''
                          return (
                            <li
                              key={nid}
                              className="rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-xs text-text-secondary"
                            >
                              <span className="font-medium text-text-primary">{label}</span>
                              {sum ? <span className="mt-0.5 block text-text-tertiary">{snippet(sum, 90)}</span> : null}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </PhaseLayout>
  )
}
