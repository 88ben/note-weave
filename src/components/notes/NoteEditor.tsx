import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '../../store/appStore'

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

export function NoteEditor() {
  const notes = useAppStore((s) => s.notes)
  const activeNoteId = useAppStore((s) => s.activeNoteId)
  const setActiveNote = useAppStore((s) => s.setActiveNote)
  const updateNote = useAppStore((s) => s.updateNote)
  const deleteNote = useAppStore((s) => s.deleteNote)

  const note = useMemo(() => notes.find((n) => n.id === activeNoteId) ?? null, [notes, activeNoteId])

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (note) {
      setDraft(note.content)
      setMode('view')
    }
  }, [note?.id])

  const handleSave = useCallback(async () => {
    if (!note || draft === note.content) {
      setMode('view')
      return
    }
    setSaving(true)
    try {
      await updateNote({
        ...note,
        content: draft,
        extractApproved: false,
        summary: undefined,
        themes: undefined,
        updatedAt: new Date().toISOString()
      })
      setMode('view')
    } finally {
      setSaving(false)
    }
  }, [note, draft, updateNote])

  const handleDelete = useCallback(async () => {
    if (!note) return
    await deleteNote(note.id)
    setActiveNote(null)
  }, [note, deleteNote, setActiveNote])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
    },
    [handleSave]
  )

  const switchToEdit = useCallback(() => {
    if (note) setDraft(note.content)
    setMode('edit')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [note])

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center text-text-tertiary">
        <p>Note not found.</p>
      </div>
    )
  }

  const hasUnsavedChanges = mode === 'edit' && draft !== note.content

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface-secondary px-6 py-3">
        <button
          type="button"
          onClick={() => setActiveNote(null)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          aria-label="Back to phase view"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-text-primary">{note.filename}</h2>
          <p className="text-xs text-text-tertiary">
            {note.originalFormat.toUpperCase()} &middot; {mode === 'edit' ? 'Editing' : 'Viewing'}
            {hasUnsavedChanges && <span className="ml-1 text-warning">&middot; Unsaved</span>}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {mode === 'view' ? (
            <button
              type="button"
              onClick={switchToEdit}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(note.content)
                  setMode('view')
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
              >
                <EyeIcon className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !hasUnsavedChanges}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger"
            aria-label="Delete note"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {mode === 'view' ? (
          <article className="prose prose-sm mx-auto max-w-3xl px-8 py-6 text-text-primary prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-accent prose-strong:text-text-primary prose-code:rounded prose-code:bg-surface-tertiary prose-code:px-1 prose-code:py-0.5 prose-code:text-accent prose-pre:bg-surface-tertiary prose-li:text-text-secondary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </article>
        ) : (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck
            className="h-full w-full resize-none border-none bg-surface px-8 py-6 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary"
            placeholder="Write your note in Markdown…"
          />
        )}
      </div>
    </div>
  )
}
