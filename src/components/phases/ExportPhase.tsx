import { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { ExportFormat, OutlineSection } from '../../../shared/types'
import { PhaseLayout, ProceedButton, Spinner } from './PhaseLayout'

function PreviewSection({ section, depth }: { section: OutlineSection; depth: number }) {
  const pad = Math.min(depth, 5) * 14
  const titleClass =
    depth === 0 ? 'text-[15px] font-bold' : depth === 1 ? 'text-sm font-semibold' : 'text-xs font-semibold'
  return (
    <div className="text-sm" style={{ marginLeft: pad }}>
      <div className="border-l-2 border-accent/35 pl-3">
        <p className={`text-text-primary ${titleClass}`}>{section.title}</p>
        {section.keyPoints.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-text-secondary">
            {section.keyPoints.map((p, i) => (
              <li key={i} className="text-xs leading-relaxed">
                {p}
              </li>
            ))}
          </ul>
        )}
        {section.transition ? (
          <p className="mt-2 border-l border-border pl-2 text-xs italic text-text-tertiary">{section.transition}</p>
        ) : null}
        {section.children.length > 0 && (
          <div className="mt-3 space-y-3">
            {section.children.map((c) => (
              <PreviewSection key={c.id} section={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h10M4 18h7M16 12l2 2 2-2m-2-2v4"
      />
    </svg>
  )
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <path strokeLinecap="round" d="M13 3v6h6M9 13h6M9 17h4" />
    </svg>
  )
}

function DocxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6M9 8h2m4 0h2M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2h-3.5L9 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  )
}

const FORMAT_OPTIONS: {
  id: ExportFormat
  name: string
  ext: string
  description: string
  Icon: typeof MarkdownIcon
}[] = [
  {
    id: 'md',
    name: 'Markdown',
    ext: '.md',
    description: 'Portable, version-control friendly text with headings and lists.',
    Icon: MarkdownIcon
  },
  {
    id: 'pdf',
    name: 'PDF',
    ext: '.pdf',
    description: 'Print-ready document for sharing or archival.',
    Icon: PdfIcon
  },
  {
    id: 'docx',
    name: 'Word',
    ext: '.docx',
    description: 'Editable Microsoft Word format for collaborators.',
    Icon: DocxIcon
  }
]

export function ExportPhase() {
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const phaseDetailData = useAppStore((s) => s.phaseDetailData)
  const setCurrentPhase = useAppStore((s) => s.setCurrentPhase)
  const setLoading = useAppStore((s) => s.setLoading)

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('md')
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const hasOutline = Boolean(phaseDetailData?.chapterOutlines?.some((c) => c.sections.length > 0))

  const previewChapters = useMemo(() => phaseDetailData?.chapterOutlines ?? [], [phaseDetailData])

  const handleExport = useCallback(async () => {
    if (!activeProjectId) return
    setExportError(null)
    setExportedPath(null)
    setIsExporting(true)
    setLoading(true, 'Exporting outline…')
    try {
      const path = await window.api.exportOutline(activeProjectId, selectedFormat)
      setExportedPath(path)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed. Please try again.')
    } finally {
      setLoading(false)
      setIsExporting(false)
    }
  }, [activeProjectId, selectedFormat, setLoading])

  return (
    <PhaseLayout
      phase="export"
      title="Export"
      description="Your notes have been shaped into a full book outline. Pick a format and export."
      error={exportError}
      onDismissError={() => setExportError(null)}
      actions={
        <ProceedButton
          onClick={() => void handleExport()}
          disabled={isExporting || !activeProjectId || !hasOutline}
        >
          {isExporting ? (
            <>
              <Spinner className="h-4 w-4" />
              Exporting…
            </>
          ) : (
            'Export'
          )}
        </ProceedButton>
      }
    >
      {!hasOutline ? (
        <div className="rounded-xl border border-dashed border-warning/40 bg-warning/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">No detailed outline to export</p>
          <p className="mt-2 text-xs text-text-secondary">
            Complete the Detail phase and approve your outline before exporting.
          </p>
          <button
            type="button"
            onClick={() => setCurrentPhase('detail')}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Go to Detail
          </button>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface-secondary/70 p-6">
            <h3 className="text-sm font-semibold text-text-primary">Outline preview</h3>
            <p className="mt-1 text-xs text-text-tertiary">Read-only snapshot of your approved structure.</p>
            <div className="mt-5 max-h-[min(420px,50vh)] space-y-8 overflow-y-auto rounded-xl border border-border/80 bg-surface p-5">
              {previewChapters.map((ch) => (
                <article key={ch.chapterId}>
                  <h4 className="border-b border-border pb-2 text-base font-bold text-text-primary">{ch.chapterTitle}</h4>
                  <div className="mt-4 space-y-4">
                    {ch.sections.map((s) => (
                      <PreviewSection key={s.id} section={s} depth={0} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Export format</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FORMAT_OPTIONS.map(({ id, name, ext, description, Icon }) => {
                const selected = selectedFormat === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSelectedFormat(id)
                      setExportedPath(null)
                      setExportError(null)
                    }}
                    className={`flex flex-col items-start rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                      selected
                        ? 'border-accent bg-accent-light/50 ring-1 ring-accent/20'
                        : 'border-border bg-surface-secondary/80 hover:border-accent/30 hover:bg-surface-secondary'
                    }`}
                  >
                    <span
                      className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${
                        selected ? 'bg-accent text-white' : 'bg-surface-tertiary text-accent'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-base font-bold text-text-primary">{name}</span>
                    <span className="mt-1 font-mono text-xs text-text-tertiary">{ext}</span>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">{description}</p>
                  </button>
                )
              })}
            </div>
          </section>

          {exportedPath ? (
            <div className="rounded-xl border border-success/35 bg-success/10 px-4 py-4 text-sm">
              <p className="font-semibold text-success">Export complete</p>
              <p className="mt-1 break-all font-mono text-xs text-text-secondary">{exportedPath}</p>
            </div>
          ) : null}
        </>
      )}
    </PhaseLayout>
  )
}
