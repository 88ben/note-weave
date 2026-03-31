import { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { AIProviderConfig, Message, Note } from '../../../shared/types'
import { PhaseLayout, ProceedButton, RedoButton, RedoIconButton, Spinner } from './PhaseLayout'

const EXTRACT_SYSTEM_MESSAGE =
  'You are an expert analyst helping organize notes into a book outline. Your task is to analyze the following note and extract: 1. A concise summary (2-3 sentences capturing the core content) 2. A list of key themes and concepts (5-15 tagged keywords/phrases). Respond in valid JSON format with: {"summary": "...", "themes": ["theme1", "theme2"]}. Respond ONLY with the JSON object, no additional text.'

function parseExtractResponse(raw: string): { summary: string; themes: string[] } {
  let text = raw.trim()
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }
  const obj = JSON.parse(text) as { summary?: unknown; themes?: unknown }
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  let themes: string[] = []
  if (Array.isArray(obj.themes)) {
    themes = obj.themes
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 15)
  }
  if (!summary) {
    throw new Error('Model returned an empty summary.')
  }
  return { summary, themes }
}

function isExtracted(note: Note): boolean {
  return Boolean(note.summary?.trim())
}

const FORMAT_STYLES: Record<Note['originalFormat'], string> = {
  md: 'bg-accent-light text-accent',
  docx: 'bg-warning/15 text-warning',
  pdf: 'bg-danger/10 text-danger',
  txt: 'bg-surface-tertiary text-text-secondary'
}

type CardStatus = 'pending' | 'extracting' | 'extracted' | 'approved'

function cardStatus(note: Note, extracting: boolean): CardStatus {
  if (extracting) return 'extracting'
  if (note.extractApproved && isExtracted(note)) return 'approved'
  if (isExtracted(note)) return 'extracted'
  return 'pending'
}

const STATUS_LABELS: Record<CardStatus, string> = {
  pending: 'Pending',
  extracting: 'Extracting…',
  extracted: 'Ready to approve',
  approved: 'Approved'
}

function StatusPill({ status }: { status: CardStatus }) {
  const styles: Record<CardStatus, string> = {
    pending: 'bg-surface-tertiary text-text-tertiary ring-1 ring-border',
    extracting: 'bg-accent-light text-accent ring-1 ring-accent/30',
    extracted: 'bg-warning/10 text-warning ring-1 ring-warning/25',
    approved: 'bg-success/10 text-success ring-1 ring-success/25'
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status === 'extracting' && <Spinner className="h-3 w-3" />}
      {STATUS_LABELS[status]}
    </span>
  )
}

export function ExtractPhase() {
  const notes = useAppStore((s) => s.notes)
  const settings = useAppStore((s) => s.settings)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const isLoading = useAppStore((s) => s.isLoading)
  const loadingMessage = useAppStore((s) => s.loadingMessage)
  const updateNote = useAppStore((s) => s.updateNote)
  const setCurrentPhase = useAppStore((s) => s.setCurrentPhase)

  const [extractingIds, setExtractingIds] = useState<Set<string>>(() => new Set())
  const [extractAllRunning, setExtractAllRunning] = useState(false)
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({})
  const [themeDrafts, setThemeDrafts] = useState<Record<string, string>>({})

  const providerOk = Boolean(settings.aiProvider.apiKey?.trim())

  const addExtracting = useCallback((id: string) => {
    setExtractingIds((prev) => new Set(prev).add(id))
  }, [])

  const removeExtracting = useCallback((id: string) => {
    setExtractingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const runExtraction = useCallback(
    async (note: Note, providerConfig: AIProviderConfig) => {
      const messages: Message[] = [
        { role: 'system', content: EXTRACT_SYSTEM_MESSAGE },
        { role: 'user', content: note.content }
      ]
      const { content } = await window.api.aiChat(messages, providerConfig)
      const { summary, themes } = parseExtractResponse(content)
      const now = new Date().toISOString()
      const updated: Note = {
        ...note,
        summary,
        themes,
        extractApproved: false,
        updatedAt: now
      }
      await updateNote(updated)
    },
    [updateNote]
  )

  const handleExtractOne = useCallback(
    async (note: Note) => {
      if (!providerOk) {
        setNoteErrors((e) => ({ ...e, [note.id]: 'Add an API key in Settings to run extraction.' }))
        return
      }
      setNoteErrors((e) => {
        const next = { ...e }
        delete next[note.id]
        return next
      })
      addExtracting(note.id)
      try {
        await runExtraction(note, settings.aiProvider)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Extraction failed.'
        setNoteErrors((e) => ({ ...e, [note.id]: msg }))
      } finally {
        removeExtracting(note.id)
      }
    },
    [addExtracting, removeExtracting, runExtraction, settings.aiProvider, providerOk]
  )

  const handleExtractAll = useCallback(async () => {
    if (!providerOk) {
      setNoteErrors((e) => ({ ...e, __bulk: 'Add an API key in Settings to run extraction.' }))
      return
    }
    const pending = notes.filter((n) => !isExtracted(n))
    if (pending.length === 0) return
    setNoteErrors((e) => {
      const next = { ...e }
      delete next.__bulk
      return next
    })
    setExtractAllRunning(true)
    for (const note of pending) {
      setNoteErrors((e) => {
        const next = { ...e }
        delete next[note.id]
        return next
      })
      addExtracting(note.id)
      try {
        await runExtraction(note, settings.aiProvider)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Extraction failed.'
        setNoteErrors((e) => ({ ...e, [note.id]: msg }))
      } finally {
        removeExtracting(note.id)
      }
    }
    setExtractAllRunning(false)
  }, [notes, runExtraction, settings.aiProvider, addExtracting, removeExtracting, providerOk])

  const handleApprove = useCallback(
    async (note: Note) => {
      const now = new Date().toISOString()
      await updateNote({ ...note, extractApproved: true, updatedAt: now })
    },
    [updateNote]
  )

  const handleApproveAll = useCallback(async () => {
    const now = new Date().toISOString()
    for (const note of notes) {
      if (isExtracted(note) && !note.extractApproved) {
        await updateNote({ ...note, extractApproved: true, updatedAt: now })
      }
    }
  }, [notes, updateNote])

  const handleSummaryBlur = useCallback(
    async (note: Note, value: string) => {
      const trimmed = value.trim()
      if (trimmed === (note.summary ?? '').trim()) return
      const now = new Date().toISOString()
      await updateNote({
        ...note,
        summary: trimmed || undefined,
        extractApproved: false,
        updatedAt: now
      })
    },
    [updateNote]
  )

  const handleThemesChange = useCallback(
    async (note: Note, themes: string[]) => {
      const now = new Date().toISOString()
      await updateNote({
        ...note,
        themes,
        extractApproved: false,
        updatedAt: now
      })
    },
    [updateNote]
  )

  const removeTheme = useCallback(
    async (note: Note, index: number) => {
      const themes = [...(note.themes ?? [])]
      themes.splice(index, 1)
      await handleThemesChange(note, themes)
    },
    [handleThemesChange]
  )

  const addTheme = useCallback(
    async (note: Note) => {
      const raw = (themeDrafts[note.id] ?? '').trim()
      if (!raw) return
      const themes = [...(note.themes ?? []), raw]
      setThemeDrafts((d) => ({ ...d, [note.id]: '' }))
      await handleThemesChange(note, themes)
    },
    [themeDrafts, handleThemesChange]
  )

  const allExtracted = notes.length > 0 && notes.every(isExtracted)
  const allApproved = notes.length > 0 && notes.every((n) => n.extractApproved && isExtracted(n))
  const hasUnapprovedExtracted = notes.some((n) => isExtracted(n) && !n.extractApproved)
  const anyExtracting = extractingIds.size > 0 || extractAllRunning

  const unextractedCount = useMemo(() => notes.filter((n) => !isExtracted(n)).length, [notes])

  const bulkError = noteErrors.__bulk
    || (!providerOk ? 'Configure your AI provider and API key in Settings before extracting.' : null)

  const dismissBulkError = bulkError === noteErrors.__bulk
    ? () => setNoteErrors((e) => { const next = { ...e }; delete next.__bulk; return next })
    : undefined

  const actions = (
    <>
      {unextractedCount > 0 && (
        <RedoButton
          onClick={() => void handleExtractAll()}
          disabled={!providerOk || anyExtracting}
        >
          {extractAllRunning ? (
            <>
              <Spinner className="h-4 w-4" />
              Extracting…
            </>
          ) : (
            'Extract All'
          )}
        </RedoButton>
      )}
      {allExtracted && hasUnapprovedExtracted && !anyExtracting && (
        <button
          type="button"
          onClick={() => void handleApproveAll()}
          className="inline-flex items-center gap-2 rounded-lg bg-success/15 px-5 py-2.5 text-sm font-semibold text-success transition-colors hover:bg-success/25"
        >
          Approve All
        </button>
      )}
      {allApproved && (
        <ProceedButton onClick={() => setCurrentPhase('cluster')}>
          Proceed to Clustering
        </ProceedButton>
      )}
    </>
  )

  return (
    <PhaseLayout
      phase="import"
      title="Extract & Summarize"
      description="AI will summarize each note and surface key themes so you can cluster and structure your book with confidence. Import or create notes from the sidebar."
      actions={actions}
      error={bulkError}
      onDismissError={dismissBulkError}
    >
      {!activeProjectId && (
        <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-text-secondary">
          Select or create a project to import notes.
        </div>
      )}

      {activeProjectId && notes.length === 0 && (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-secondary/80 px-6 py-16">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 text-text-secondary">
              <Spinner className="h-10 w-10 text-accent" />
              <p className="text-sm font-medium">{loadingMessage || 'Working…'}</p>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Import or create notes from the sidebar to get started.
            </p>
          )}
        </div>
      )}

      {activeProjectId && notes.length > 0 && (
        <div className="space-y-6">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{notes.length}</span> note
            {notes.length !== 1 ? 's' : ''}
            {unextractedCount > 0 && (
              <>
                {' · '}
                <span className="text-warning">{unextractedCount}</span> need extraction
              </>
            )}
          </p>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {notes.map((note) => {
              const extracted = isExtracted(note)
              const extracting = extractingIds.has(note.id)
              const status = cardStatus(note, extracting)
              const err = noteErrors[note.id]

              return (
                <article
                  key={note.id}
                  className="flex flex-col rounded-xl border border-border bg-surface-secondary p-4 shadow-sm transition hover:border-border-focus/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-text-primary" title={note.filename}>
                        {note.filename}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${FORMAT_STYLES[note.originalFormat]}`}
                        >
                          {note.originalFormat}
                        </span>
                        <StatusPill status={status} />
                      </div>
                    </div>
                  </div>

                  {err && (
                    <div className="mt-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                      {err}
                    </div>
                  )}

                  <div className="mt-4 flex-1 space-y-3">
                    {extracted ? (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary">
                            Summary
                          </label>
                          <textarea
                            defaultValue={note.summary ?? ''}
                            key={`${note.id}-${note.updatedAt}`}
                            rows={4}
                            disabled={extracting}
                            onBlur={(e) => void handleSummaryBlur(note, e.target.value)}
                            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus disabled:opacity-60"
                            placeholder="Summary…"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary">
                            Themes
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {(note.themes ?? []).map((t, i) => (
                              <span
                                key={`${t}-${i}`}
                                className="group inline-flex items-center gap-1 rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-medium text-accent"
                              >
                                {t}
                                <button
                                  type="button"
                                  disabled={extracting}
                                  onClick={() => void removeTheme(note, i)}
                                  className="rounded-full p-0.5 text-accent/70 hover:bg-accent/20 hover:text-accent disabled:opacity-40"
                                  aria-label={`Remove ${t}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              value={themeDrafts[note.id] ?? ''}
                              disabled={extracting}
                              onChange={(e) =>
                                setThemeDrafts((d) => ({ ...d, [note.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void addTheme(note)
                                }
                              }}
                              placeholder="Add theme…"
                              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus disabled:opacity-60"
                            />
                            <button
                              type="button"
                              disabled={extracting}
                              onClick={() => void addTheme(note)}
                              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-tertiary"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-text-tertiary">
                        Run extraction to generate a summary and themes from this note.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    {!extracted && (
                      <button
                        type="button"
                        disabled={!providerOk || extracting || anyExtracting}
                        onClick={() => void handleExtractOne(note)}
                        className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {extracting ? (
                          <>
                            <Spinner className="h-4 w-4 text-white" />
                            Extracting…
                          </>
                        ) : (
                          'Extract'
                        )}
                      </button>
                    )}
                    {extracted && (
                      <>
                        {!note.extractApproved && (
                          <button
                            type="button"
                            disabled={extracting || anyExtracting}
                            onClick={() => void handleApprove(note)}
                            className="inline-flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm font-semibold text-success hover:bg-success/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        <RedoIconButton
                          onClick={() => void handleExtractOne(note)}
                          disabled={!providerOk || extracting || anyExtracting}
                          title="Re-extract"
                        />
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </PhaseLayout>
  )
}
