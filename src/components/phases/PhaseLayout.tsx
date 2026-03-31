import { type ReactNode, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Phase } from '../../../shared/types'

const PHASE_META: { phase: Phase; number: number; prev?: Phase }[] = [
  { phase: 'import', number: 1 },
  { phase: 'cluster', number: 2, prev: 'import' },
  { phase: 'structure', number: 3, prev: 'cluster' },
  { phase: 'detail', number: 4, prev: 'structure' },
  { phase: 'export', number: 5, prev: 'detail' }
]

export function PhaseLayout({
  phase,
  title,
  description,
  actions,
  children,
  error,
  onDismissError
}: {
  phase: Phase
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
  error?: string | null
  onDismissError?: () => void
}) {
  const setCurrentPhase = useAppStore((s) => s.setCurrentPhase)
  const meta = PHASE_META.find((m) => m.phase === phase) ?? PHASE_META[0]

  const actionBar = (
    <div className="flex items-center justify-between">
      <div>
        {meta.prev && (
          <BackButton onClick={() => setCurrentPhase(meta.prev!)}>
            Back
          </BackButton>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
        <div className="mx-auto w-full max-w-5xl flex-1 space-y-6">
          {actionBar}

          <header>
            <span className="inline-block rounded-full bg-accent-light px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
              Phase {meta.number}
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary">{description}</p>
          </header>

          {error && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              <span>{error}</span>
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="shrink-0 text-xs font-medium text-danger hover:underline"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {children}

          <div className="border-t border-border pt-6">
            {actionBar}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProceedButton({
  children,
  onClick,
  disabled
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-success/15 px-5 py-2.5 text-sm font-semibold text-success transition-colors hover:bg-success/25 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </button>
  )
}

export function AdjustButton({
  children,
  onClick,
  disabled
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function RedoButton({
  children,
  onClick,
  disabled
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-warning/40 hover:text-warning disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function RedoIconButton({
  onClick,
  disabled,
  title
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-warning/40 hover:text-warning disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M21 3v6h-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 12a9 9 0 1 1-2.636-6.364L21 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 9.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"
          fill="currentColor"
        />
      </svg>
    </button>
  )
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-warning/40 hover:text-warning"
          >
            {confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BackButton({
  children,
  onClick
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
      </svg>
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
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
