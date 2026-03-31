import { useCallback, useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Phase } from '../../../shared/types'

const STEPPER_STEPS: { label: string; phases: Phase[] }[] = [
  { label: '1. Import & Extract', phases: ['import', 'extract'] },
  { label: '2. Cluster', phases: ['cluster'] },
  { label: '3. Structure', phases: ['structure'] },
  { label: '4. Detail', phases: ['detail'] },
  { label: '5. Export', phases: ['export'] }
]

function phaseToStepIndex(phase: Phase): number {
  if (phase === 'import' || phase === 'extract') return 0
  if (phase === 'cluster') return 1
  if (phase === 'structure') return 2
  if (phase === 'detail') return 3
  return 4
}

function stepIndexToPhase(index: number): Phase {
  if (index <= 0) return 'import'
  if (index === 1) return 'cluster'
  if (index === 2) return 'structure'
  if (index === 3) return 'detail'
  return 'export'
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function TopBar() {
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const currentPhase = useAppStore((s) => s.currentPhase)
  const setCurrentPhase = useAppStore((s) => s.setCurrentPhase)

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  )

  const maxReachableStep = activeProject ? phaseToStepIndex(activeProject.currentPhase) : -1
  const currentStepIndex = phaseToStepIndex(currentPhase)

  const onStepClick = useCallback(
    (stepIndex: number) => {
      if (!activeProjectId || !activeProject) return
      if (stepIndex > maxReachableStep) return
      setCurrentPhase(stepIndexToPhase(stepIndex))
    },
    [activeProject, activeProjectId, maxReachableStep, setCurrentPhase]
  )

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-surface-secondary/80 px-6 backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        {activeProject ? (
          <h1 className="truncate text-sm font-semibold tracking-tight text-text-primary">{activeProject.name}</h1>
        ) : (
          <p className="text-sm text-text-tertiary">Select a project</p>
        )}
      </div>

      <nav className="flex flex-1 items-center justify-center gap-1 px-4" aria-label="Workflow phases">
        {STEPPER_STEPS.map((step, index) => {
          const completed = index < currentStepIndex
          const current = index === currentStepIndex
          const reachable = index <= maxReachableStep
          const clickable = Boolean(activeProjectId && reachable)

          return (
            <div key={step.label} className="flex items-center">
              {index > 0 && (
                <div
                  className={`mx-1 hidden h-px w-6 sm:block ${index <= currentStepIndex ? 'bg-success/40' : 'bg-border'}`}
                  aria-hidden
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick(index)}
                title={!activeProjectId ? 'Select a project' : !reachable ? 'Complete earlier phases first' : step.label}
                className={`group flex max-w-[140px] items-center gap-2 rounded-full px-3 py-1.5 text-left transition-all duration-200 ${
                  current
                    ? 'bg-accent-light text-accent shadow-sm ring-1 ring-accent/25'
                    : completed
                      ? 'text-success hover:bg-surface-tertiary'
                      : 'text-text-tertiary'
                } ${clickable && !current ? 'hover:bg-surface-tertiary hover:text-text-secondary' : ''} ${
                  !clickable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-200 ${
                    completed
                      ? 'bg-success/15 text-success'
                      : current
                        ? 'bg-accent text-white'
                        : 'bg-surface-tertiary text-text-tertiary group-hover:text-text-secondary'
                  }`}
                >
                  {completed ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="hidden truncate text-xs font-medium sm:inline">{step.label}</span>
              </button>
            </div>
          )
        })}
      </nav>

      <div className="min-w-0 flex-1" />
    </header>
  )
}
