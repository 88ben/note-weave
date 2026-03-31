import { useCallback, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Project } from '../../../shared/types'

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-3.293 3.293c-.63.63-1.707.184-1.707-.707V16a1 1 0 00-1-1H8a1 1 0 00-1 1v.586c0 .89-1.077 1.337-1.707.707L4 13m16 0H4"
      />
    </svg>
  )
}

export function Sidebar() {
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const notes = useAppStore((s) => s.notes)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const createProject = useAppStore((s) => s.createProject)
  const deleteProject = useAppStore((s) => s.deleteProject)
  const importNotes = useAppStore((s) => s.importNotes)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSelectProject = useCallback(
    (id: string) => {
      void setActiveProject(id)
    },
    [setActiveProject]
  )

  const handleCreateSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const name = newName.trim()
      if (!name || submitting) return
      setSubmitting(true)
      try {
        const project = await createProject(name, newDescription.trim())
        setNewName('')
        setNewDescription('')
        setCreating(false)
        await setActiveProject(project.id)
      } finally {
        setSubmitting(false)
      }
    },
    [createProject, newDescription, newName, setActiveProject, submitting]
  )

  const handleDeleteProject = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      void deleteProject(id)
    },
    [deleteProject]
  )

  const handleImport = useCallback(() => {
    void importNotes()
  }, [importNotes])

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-hover/60 bg-sidebar text-sidebar-text shadow-[4px_0_24px_rgba(0,0,0,0.12)]">
      <header className="drag-region flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/5 px-4">
        <span className="truncate text-sm font-semibold tracking-tight text-sidebar-text">NoteWeave</span>
        <button
          type="button"
          className="no-drag flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-text-dim transition-colors duration-200 hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          <GearIcon className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-text-dim">Projects</h2>
          <button
            type="button"
            className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-sidebar-text-dim transition-all duration-200 hover:bg-sidebar-hover hover:text-accent-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            onClick={() => setCreating((c) => !c)}
            aria-label={creating ? 'Cancel new project' : 'New project'}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        {creating && (
          <form
            onSubmit={handleCreateSubmit}
            className="mx-2 mb-3 space-y-2 rounded-xl border border-white/10 bg-sidebar-hover/40 p-3 shadow-inner transition-all duration-200"
          >
            <input
              className="w-full rounded-lg border border-white/10 bg-sidebar-active/50 px-2.5 py-1.5 text-sm text-sidebar-text placeholder:text-sidebar-text-dim/80 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <textarea
              className="min-h-[64px] w-full resize-none rounded-lg border border-white/10 bg-sidebar-active/50 px-2.5 py-1.5 text-xs text-sidebar-text placeholder:text-sidebar-text-dim/80 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-0.5">
              <button
                type="button"
                className="rounded-lg px-2.5 py-1 text-xs text-sidebar-text-dim transition-colors hover:text-sidebar-text"
                onClick={() => {
                  setCreating(false)
                  setNewName('')
                  setNewDescription('')
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newName.trim() || submitting}
                className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <ul className="space-y-0.5">
            {projects.map((project: Project) => {
              const active = project.id === activeProjectId
              return (
                <li key={project.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectProject(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectProject(project.id)
                      }
                    }}
                    className={`group relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition-all duration-200 ${
                      active
                        ? 'bg-sidebar-active text-sidebar-text shadow-sm ring-1 ring-white/10'
                        : 'text-sidebar-text-dim hover:bg-sidebar-hover hover:text-sidebar-text'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
                    <button
                      type="button"
                      className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-text-dim opacity-0 transition-all duration-200 hover:bg-danger/20 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      aria-label={`Delete ${project.name}`}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {projects.length === 0 && !creating && (
            <p className="px-2 py-6 text-center text-xs leading-relaxed text-sidebar-text-dim">
              No projects yet. Use <span className="text-sidebar-text">+</span> to create one.
            </p>
          )}

          {activeProjectId && (
            <div className="mt-5 border-t border-white/5 pt-4">
              <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-text-dim">Notes</h3>
              {notes.length === 0 ? (
                <div className="mx-1 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-sidebar-hover/20 px-3 py-6 text-center">
                  <InboxIcon className="h-8 w-8 text-sidebar-text-dim/60" />
                  <p className="text-xs text-sidebar-text-dim">No notes in this project.</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="truncate rounded-lg px-2.5 py-1.5 text-xs text-sidebar-text-dim transition-colors duration-200 hover:bg-sidebar-hover/80 hover:text-sidebar-text"
                      title={note.filename}
                    >
                      {note.filename}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={handleImport}
                className="no-drag mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-sidebar-hover/30 py-2 text-xs font-medium text-sidebar-text transition-all duration-200 hover:border-accent/40 hover:bg-sidebar-hover hover:text-accent-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <InboxIcon className="h-3.5 w-3.5" />
                Import notes
              </button>
            </div>
          )}
        </nav>
      </div>
    </aside>
  )
}
