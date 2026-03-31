import { useAppStore } from '../../store/appStore'
import { ExtractPhase } from '../phases/ExtractPhase'
import { ClusterPhase } from '../phases/ClusterPhase'
import { StructurePhase } from '../phases/StructurePhase'
import { DetailPhase } from '../phases/DetailPhase'
import { ExportPhase } from '../phases/ExportPhase'

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent ${className ?? ''}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function MainPanel() {
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const currentPhase = useAppStore((s) => s.currentPhase)
  const isLoading = useAppStore((s) => s.isLoading)
  const loadingMessage = useAppStore((s) => s.loadingMessage)

  const phaseBody =
    currentPhase === 'import' || currentPhase === 'extract' ? (
      <ExtractPhase />
    ) : currentPhase === 'cluster' ? (
      <ClusterPhase />
    ) : currentPhase === 'structure' ? (
      <StructurePhase />
    ) : currentPhase === 'detail' ? (
      <DetailPhase />
    ) : (
      <ExportPhase />
    )

  return (
    <main className="relative min-h-0 flex-1 overflow-hidden bg-surface">
      {!activeProjectId ? (
        <div className="flex h-full flex-col items-center justify-center px-8 py-16">
          <div className="relative mb-8 flex h-36 w-36 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-light/80 to-surface-secondary shadow-inner ring-1 ring-border/60">
            <div className="absolute inset-3 rounded-2xl border border-dashed border-accent/30" />
            <svg
              className="relative h-16 w-16 text-accent/90"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 20h32M16 32h24M16 44h28"
              />
              <rect x="8" y="12" width="48" height="40" rx="4" className="text-border" />
            </svg>
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold tracking-tight text-text-primary">Welcome to NoteWeave</h2>
          <p className="max-w-md text-center text-sm leading-relaxed text-text-secondary">
            Choose a project from the sidebar to import notes, run extraction, and weave them into a structured outline.
          </p>
        </div>
      ) : (
        <div className="h-full overflow-auto p-6 transition-opacity duration-200">{phaseBody}</div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface/75 backdrop-blur-[2px] transition-opacity duration-200">
          <Spinner className="h-10 w-10 text-accent" />
          {loadingMessage ? (
            <p className="mt-4 max-w-xs text-center text-sm font-medium text-text-secondary">{loadingMessage}</p>
          ) : null}
        </div>
      )}
    </main>
  )
}
