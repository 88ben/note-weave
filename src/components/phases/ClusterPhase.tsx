import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Message, Note, PhaseClusterData, ThemeCluster } from '../../../shared/types'
import { PhaseLayout, ProceedButton, AdjustButton, RedoIconButton, ConfirmModal } from './PhaseLayout'

const CLUSTER_SYSTEM_PROMPT =
  'You are an expert book editor helping organize research notes into thematic clusters that will eventually become book chapters. Group the following note summaries into logical thematic clusters. Respond in JSON: {"clusters": [{"id": "cluster-1", "name": "...", "description": "...", "noteIds": ["..."]}]}'

function parseAiJsonObject(raw: string): { clusters?: ThemeCluster[] } {
  let s = raw.trim()
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im
  const m = s.match(fence)
  if (m) s = m[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  return JSON.parse(s) as { clusters?: ThemeCluster[] }
}

function snippet(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
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

export function ClusterPhase() {
  const notes = useAppStore((s) => s.notes)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const settings = useAppStore((s) => s.settings)
  const phaseClusterData = useAppStore((s) => s.phaseClusterData)
  const savePhaseClusterData = useAppStore((s) => s.savePhaseClusterData)
  const setCurrentPhase = useAppStore((s) => s.setCurrentPhase)
  const setLoading = useAppStore((s) => s.setLoading)

  const [clusters, setClusters] = useState<ThemeCluster[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)

  useEffect(() => {
    if (phaseClusterData?.clusters?.length) {
      setClusters(phaseClusterData.clusters.map((c) => ({ ...c, noteIds: [...c.noteIds] })))
      setGeneratedAt(phaseClusterData.generatedAt ?? null)
    } else {
      setClusters([])
      setGeneratedAt(null)
    }
  }, [phaseClusterData])

  const noteById = useMemo(() => {
    const m = new Map<string, Note>()
    for (const n of notes) m.set(n.id, n)
    return m
  }, [notes])

  const noteIdsInClusters = useMemo(() => new Set(clusters.flatMap((c) => c.noteIds)), [clusters])

  const orphanNotes = useMemo(
    () => notes.filter((n) => n.projectId === activeProjectId && !noteIdsInClusters.has(n.id)),
    [notes, activeProjectId, noteIdsInClusters]
  )

  const notesReadyForAi = useMemo(() => {
    return notes.filter(
      (n) => n.projectId === activeProjectId && n.extractApproved && Boolean((n.summary ?? '').trim())
    )
  }, [notes, activeProjectId])

  const runClustering = useCallback(async () => {
    setError(null)
    if (!settings.aiProvider.apiKey.trim()) {
      setError('Add an API key in Settings to use AI clustering.')
      return
    }
    if (notesReadyForAi.length === 0) {
      setError('No notes with approved extraction and a summary are available. Finish the extract step first.')
      return
    }

    const payload = notesReadyForAi.map((n) => ({
      id: n.id,
      filename: n.filename,
      summary: n.summary ?? '',
      themes: n.themes ?? []
    }))

    const messages: Message[] = [
      { role: 'system', content: CLUSTER_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) }
    ]

    setLoading(true, 'Generating thematic clusters…')
    try {
      const { content } = await window.api.aiChat(messages, settings.aiProvider)
      const parsed = parseAiJsonObject(content)
      const list = parsed.clusters
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('The model returned no clusters. Try again or check your model settings.')
      }
      const normalized: ThemeCluster[] = list.map((c, i) => ({
        id: typeof c.id === 'string' && c.id ? c.id : `cluster-${i + 1}`,
        name: typeof c.name === 'string' ? c.name : `Cluster ${i + 1}`,
        description: typeof c.description === 'string' ? c.description : '',
        noteIds: Array.isArray(c.noteIds) ? c.noteIds.filter((id): id is string => typeof id === 'string') : []
      }))
      setClusters(normalized)
      setGeneratedAt(new Date().toISOString())
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Clustering failed.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [notesReadyForAi, settings.aiProvider, setLoading])

  const updateCluster = useCallback((id: string, patch: Partial<ThemeCluster>) => {
    setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const addCluster = useCallback(() => {
    const n = clusters.length + 1
    setClusters((prev) => [
      ...prev,
      { id: `cluster-new-${Date.now()}`, name: `New cluster ${n}`, description: '', noteIds: [] }
    ])
  }, [clusters.length])

  const deleteCluster = useCallback((id: string) => {
    setClusters((prev) => {
      const removed = prev.find((c) => c.id === id)
      if (!removed) return prev
      const rest = prev.filter((c) => c.id !== id)
      if (removed.noteIds.length === 0 || rest.length === 0) return rest
      const [first, ...others] = rest
      return [{ ...first, noteIds: [...first.noteIds, ...removed.noteIds] }, ...others]
    })
  }, [])

  const moveNoteToCluster = useCallback((noteId: string, toClusterId: string) => {
    setClusters((prev) =>
      prev.map((c) => {
        let noteIds = c.noteIds.filter((id) => id !== noteId)
        if (c.id === toClusterId) noteIds = [...noteIds, noteId]
        return { ...c, noteIds }
      })
    )
  }, [])

  const handleApprove = useCallback(async () => {
    setError(null)
    if (clusters.length === 0) {
      setError('Generate or add at least one cluster before continuing.')
      return
    }
    const now = new Date().toISOString()
    const data: PhaseClusterData = {
      clusters,
      approved: true,
      generatedAt: generatedAt ?? now,
      approvedAt: now
    }
    try {
      await savePhaseClusterData(data)
      setCurrentPhase('structure')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save cluster data.')
    }
  }, [clusters, generatedAt, savePhaseClusterData, setCurrentPhase])

  return (
    <PhaseLayout
      phase="cluster"
      title="Cluster & Categorize"
      description="Group your note summaries into thematic clusters. Refine names and membership, then approve to shape your book structure."
      error={error}
      onDismissError={() => setError(null)}
      actions={
        <>
          <RedoIconButton
            onClick={() => {
              if (clusters.length > 0) { setConfirmRegen(true) } else { void runClustering() }
            }}
            title={clusters.length ? 'Re-generate clusters' : 'Generate clusters'}
          />
          <AdjustButton onClick={addCluster}>Add Cluster</AdjustButton>
          <ProceedButton onClick={() => void handleApprove()} disabled={clusters.length === 0}>
            Approve & Continue
          </ProceedButton>
        </>
      }
    >
      <ConfirmModal
        open={confirmRegen}
        title="Re-generate clusters?"
        message="This will replace all existing clusters with new AI-generated ones. Your current cluster names, descriptions, and note assignments will be lost."
        confirmLabel="Re-generate"
        onConfirm={() => { setConfirmRegen(false); void runClustering() }}
        onCancel={() => setConfirmRegen(false)}
      />

      {orphanNotes.length > 0 && (
        <section className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">Unassigned notes</h3>
          <p className="mb-3 text-xs text-text-secondary">
            These notes are not in any cluster yet. Move each into a cluster below.
          </p>
          <ul className="flex flex-col gap-2">
            {orphanNotes.map((note) => (
              <li
                key={note.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{note.filename}</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">{snippet(note.summary ?? note.content)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {clusters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => moveNoteToCluster(note.id, c.id)}
                      className="rounded-lg border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      → {c.name}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {clusters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary/60 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent">
            <SparklesIcon className="h-8 w-8" />
          </div>
          <p className="max-w-md text-sm text-text-secondary">
            Run <span className="font-medium text-text-primary">Generate Clusters</span> to let AI propose themes from
            your approved summaries, or add empty clusters and organize notes manually.
          </p>
          {notesReadyForAi.length === 0 && (
            <p className="mt-3 max-w-md text-xs text-text-tertiary">
              You need notes with approved extraction and non-empty summaries.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clusters.map((cluster) => (
            <article
              key={cluster.id}
              className="flex flex-col rounded-xl border border-border bg-surface-secondary p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <input
                  type="text"
                  value={cluster.name}
                  onChange={(e) => updateCluster(cluster.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-surface px-2 py-1 text-sm font-semibold text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                  aria-label="Cluster name"
                />
                <button
                  type="button"
                  onClick={() => deleteCluster(cluster.id)}
                  className="shrink-0 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                  aria-label={`Delete cluster ${cluster.name}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={cluster.description}
                onChange={(e) => updateCluster(cluster.id, { description: e.target.value })}
                rows={3}
                className="mb-3 w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-2 text-xs leading-relaxed text-text-secondary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                placeholder="Short description of this theme…"
                aria-label="Cluster description"
              />
              <div className="min-h-[120px] flex-1 space-y-2">
                {cluster.noteIds.length === 0 ? (
                  <p className="py-6 text-center text-xs text-text-tertiary">No notes in this cluster</p>
                ) : (
                  <ul className="space-y-2">
                    {cluster.noteIds.map((nid) => {
                      const note = noteById.get(nid)
                      if (!note) {
                        return (
                          <li
                            key={nid}
                            className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-2.5 py-2 text-xs text-warning"
                          >
                            Unknown note ID
                          </li>
                        )
                      }
                      return (
                        <li
                          key={nid}
                          className="rounded-xl border border-border bg-surface p-2.5"
                        >
                          <p className="truncate text-xs font-medium text-text-primary">{note.filename}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-tertiary">
                            {snippet(note.summary ?? note.content, 100)}
                          </p>
                          {clusters.filter((c) => c.id !== cluster.id).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="mr-1 self-center text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                                Move to
                              </span>
                              {clusters
                                .filter((c) => c.id !== cluster.id)
                                .map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => moveNoteToCluster(nid, c.id)}
                                    className="rounded-md bg-surface-tertiary px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-accent-light hover:text-accent"
                                  >
                                    {c.name}
                                  </button>
                                ))}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </PhaseLayout>
  )
}
