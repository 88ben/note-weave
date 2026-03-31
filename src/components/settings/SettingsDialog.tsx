import { useCallback, useEffect, useRef, useState } from 'react'
import type { AIProviderType, AppSettings } from '../../../shared/types'
import { useAppStore } from '../../store/appStore'

const MODELS_BY_PROVIDER: Record<AIProviderType, readonly string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o3-mini'],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-3-5-haiku-20241022',
    'claude-opus-4-20250514'
  ],
  google: [
    'gemini-2.0-flash',
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.5-flash-preview-04-17'
  ]
}

const MODEL_LABELS: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  o1: 'o1',
  'o3-mini': 'o3-mini',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-opus-4-20250514': 'Claude Opus 4',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.5-pro-preview-05-06': 'Gemini 2.5 Pro (preview)',
  'gemini-2.5-flash-preview-04-17': 'Gemini 2.5 Flash (preview)'
}

const PROVIDERS: { type: AIProviderType; label: string; description: string }[] = [
  { type: 'openai', label: 'OpenAI', description: 'GPT-4, o-series models' },
  { type: 'anthropic', label: 'Anthropic', description: 'Claude Sonnet, Haiku, Opus' },
  { type: 'google', label: 'Google Gemini', description: 'Gemini 2.x family' }
]

const THEMES: { value: AppSettings['theme']; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

function cloneSettings(s: AppSettings): AppSettings {
  return {
    ...s,
    aiProvider: { ...s.aiProvider }
  }
}

export function SettingsDialog() {
  const settingsOpen = useAppStore((state) => state.settingsOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const saveSettings = useAppStore((state) => state.saveSettings)

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState<AppSettings>(() =>
    cloneSettings(useAppStore.getState().settings)
  )
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!settingsOpen) {
      setVisible(false)
      const t = window.setTimeout(() => setMounted(false), 280)
      return () => window.clearTimeout(t)
    }
    setMounted(true)
    setDraft(cloneSettings(useAppStore.getState().settings))
    setShowApiKey(false)
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [settingsOpen])

  useEffect(() => {
    if (!visible) return
    const id = window.setTimeout(() => closeRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [visible])

  const handleClose = useCallback(() => {
    setSettingsOpen(false)
  }, [setSettingsOpen])

  const handleProviderChange = (type: AIProviderType) => {
    const models = MODELS_BY_PROVIDER[type]
    setDraft((d) => {
      const nextModel = models.includes(d.aiProvider.model) ? d.aiProvider.model : models[0]
      return {
        ...d,
        aiProvider: { ...d.aiProvider, type, model: nextModel }
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSettings(draft)
      setSettingsOpen(false)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, handleClose])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-drag"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close settings"
        className={`absolute inset-0 cursor-default bg-text-primary/40 backdrop-blur-[2px] transition-[opacity,backdrop-filter] duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className={`relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="settings-dialog-title"
            className="text-lg font-semibold tracking-tight text-text-primary"
          >
            Settings
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                AI provider
              </h3>
              <p className="mt-1 text-sm text-text-secondary">Choose your API and model for AI features.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {PROVIDERS.map(({ type, label, description }) => {
                const selected = draft.aiProvider.type === type
                return (
                  <label
                    key={type}
                    className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-[border-color,box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none ${
                      selected
                        ? 'border-accent bg-accent-light/80 shadow-[inset_0_0_0_1px] shadow-accent/20 dark:bg-accent-light/30'
                        : 'border-border bg-surface-secondary hover:border-text-tertiary/40 hover:bg-surface-tertiary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ai-provider"
                      className="sr-only"
                      checked={selected}
                      onChange={() => handleProviderChange(type)}
                    />
                    <span className="text-sm font-medium text-text-primary">{label}</span>
                    <span className="mt-0.5 text-xs leading-snug text-text-tertiary">{description}</span>
                    {selected && (
                      <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </label>
                )
              })}
            </div>

            <div className="space-y-2">
              <label htmlFor="settings-api-key" className="text-sm font-medium text-text-primary">
                API key
              </label>
              <div className="relative">
                <input
                  id="settings-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  autoComplete="off"
                  value={draft.aiProvider.apiKey}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      aiProvider: { ...d.aiProvider, apiKey: e.target.value }
                    }))
                  }
                  placeholder="sk-…"
                  className="w-full rounded-xl border border-border bg-surface-secondary py-2.5 pl-3.5 pr-11 text-sm text-text-primary shadow-sm transition-[border-color,box-shadow] placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/25"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="settings-model" className="text-sm font-medium text-text-primary">
                Model
              </label>
              <div className="relative">
                <select
                  id="settings-model"
                  value={draft.aiProvider.model}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      aiProvider: { ...d.aiProvider, model: e.target.value }
                    }))
                  }
                  className="w-full appearance-none rounded-xl border border-border bg-surface-secondary py-2.5 pl-3.5 pr-10 text-sm text-text-primary shadow-sm transition-[border-color,box-shadow] focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/25"
                >
                  {MODELS_BY_PROVIDER[draft.aiProvider.type].map((id) => (
                    <option key={id} value={id}>
                      {MODEL_LABELS[id] ?? id}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </div>
          </section>

          <section className="mt-8 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Appearance</h3>
            <div className="inline-flex rounded-xl border border-border bg-surface-secondary p-1 shadow-inner">
              {THEMES.map(({ value, label }) => {
                const on = draft.theme === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, theme: value }))}
                    className={`relative min-w-[5.5rem] rounded-lg px-3 py-2 text-sm font-medium transition-[color,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
                      on
                        ? 'bg-surface text-text-primary shadow-sm ring-1 ring-border'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface-secondary/80 px-6 py-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary transition-[background-color,color,border-color] hover:bg-surface-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-[background-color,transform,box-shadow] hover:bg-accent-hover hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 motion-reduce:active:scale-100"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  )
}
