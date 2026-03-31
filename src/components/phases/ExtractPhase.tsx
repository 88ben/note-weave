import { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { AIProviderConfig, Message, Note } from '../../../shared/types'

/**
 * Embedded copy of prompts/extract.md for documentation parity.
 * At runtime we send EXTRACT_SYSTEM_MESSAGE (matches product spec).
 */
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

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-current ${className ?? 'h-5 w-5'}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
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
  const importNotes = useAppStore((s) => s.importNotes)
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

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <header className="shrink-0 border-b border-border bg-surface-secondary px-8 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Import & Extract</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Bring in notes from Markdown, Word, PDF, or plain text. We&apos;ll summarize each note and
            surface themes so you can cluster and structure your book with confidence.
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
        <div className="mx-auto w-full max-w-6xl flex-1">
          {!activeProjectId && (
            <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-text-secondary">
              Select or create a project to import notes.
            </div>
          )}

          {activeProjectId && notes.length === 0 && (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-secondary/80 px-6 py-16 transition-colors hover:border-border-focus/50 hover:bg-accent-light/30">
              {isLoading ? (
                <div className="flex flex-col items-center gap-4 text-text-secondary">
                  <Spinner className="h-10 w-10 text-accent" />
                  <p className="text-sm font-medium">{loadingMessage || 'Working…'}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-full bg-accent-light p-4 text-accent">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <h2 className="mt-6 text-lg font-semibold text-text-primary">Import your notes</h2>
                  <p className="mt-2 max-w-md text-center text-sm text-text-secondary">
                    Drop files here when supported, or use the button to choose Markdown, DOCX, PDF, or
                    TXT files from your computer.
                  </p>
                  <button
                    type="button"
                    disabled={!activeProjectId}
                    onClick={() => void importNotes()}
                    className="no-drag mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Import Notes
                  </button>
                </>
              )}
            </div>
          )}

          {activeProjectId && notes.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void importNotes()}
                    disabled={isLoading || anyExtracting}
                    className="no-drag rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        Importing…
                      </span>
                    ) : (
                      'Import more'
                    )}
                  </button>
                  {unextractedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleExtractAll()}
                      disabled={!providerOk || anyExtracting}
                      className="no-drag inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {extractAllRunning ? (
                        <>
                          <Spinner className="h-4 w-4 text-white" />
                          Extract all…
                        </>
                      ) : (
                        'Extract all'
                      )}
                    </button>
                  )}
                  {allExtracted && hasUnapprovedExtracted && !anyExtracting && (
                    <button
                      type="button"
                      onClick={() => void handleApproveAll()}
                      className="no-drag rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-sm font-semibold text-success transition hover:bg-success/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-success/40"
                    >
                      Approve all
                    </button>
                  )}
                  {allApproved && (
                    <button
                      type="button"
                      onClick={() => setCurrentPhase('cluster')}
                      className="no-drag inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    >
                      Proceed to clustering
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {!providerOk && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-primary">
                  Configure your AI provider and API key in Settings before extracting.
                </div>
              )}

              {noteErrors.__bulk && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {noteErrors.__bulk}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                                className="rounded-lg bg-success/15 px-3 py-2 text-sm font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!providerOk || extracting || anyExtracting}
                              onClick={() => void handleExtractOne(note)}
                              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-tertiary disabled:opacity-50"
                            >
                              Re-extract
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
