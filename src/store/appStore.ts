import { create } from 'zustand'
import type {
  Project,
  Note,
  Phase,
  AppSettings,
  AIProviderConfig,
  PhaseClusterData,
  PhaseStructureData,
  PhaseDetailData
} from '../../shared/types'

interface AppState {
  projects: Project[]
  activeProjectId: string | null
  notes: Note[]
  currentPhase: Phase
  settings: AppSettings
  settingsOpen: boolean

  phaseClusterData: PhaseClusterData | null
  phaseStructureData: PhaseStructureData | null
  phaseDetailData: PhaseDetailData | null

  isLoading: boolean
  loadingMessage: string

  loadProjects: () => Promise<void>
  loadSettings: () => Promise<void>
  setActiveProject: (id: string | null) => Promise<void>
  createProject: (name: string, description: string) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  setCurrentPhase: (phase: Phase) => void
  setSettingsOpen: (open: boolean) => void
  saveSettings: (settings: AppSettings) => Promise<void>

  loadNotes: (projectId: string) => Promise<void>
  importNotes: () => Promise<Note[]>
  updateNote: (note: Note) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>

  loadPhaseData: (projectId: string) => Promise<void>
  savePhaseClusterData: (data: PhaseClusterData) => Promise<void>
  savePhaseStructureData: (data: PhaseStructureData) => Promise<void>
  savePhaseDetailData: (data: PhaseDetailData) => Promise<void>

  setLoading: (loading: boolean, message?: string) => void
}

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: {
    type: 'openai',
    apiKey: '',
    model: 'gpt-4o'
  },
  dataDirectory: '',
  theme: 'system'
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  notes: [],
  currentPhase: 'import',
  settings: DEFAULT_SETTINGS,
  settingsOpen: false,
  phaseClusterData: null,
  phaseStructureData: null,
  phaseDetailData: null,
  isLoading: false,
  loadingMessage: '',

  loadProjects: async () => {
    const projects = await window.api.getProjects()
    set({ projects })
  },

  loadSettings: async () => {
    const settings = await window.api.getSettings()
    set({ settings: { ...DEFAULT_SETTINGS, ...settings } })
  },

  setActiveProject: async (id) => {
    set({ activeProjectId: id, notes: [], phaseClusterData: null, phaseStructureData: null, phaseDetailData: null })
    if (id) {
      const project = await window.api.getProject(id)
      if (project) {
        set({ currentPhase: project.currentPhase || 'import' })
      }
      await get().loadNotes(id)
      await get().loadPhaseData(id)
    }
  },

  createProject: async (name, description) => {
    const project = await window.api.createProject(name, description)
    set((s) => ({ projects: [...s.projects, project] }))
    return project
  },

  deleteProject: async (id) => {
    await window.api.deleteProject(id)
    const { activeProjectId } = get()
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      ...(activeProjectId === id
        ? { activeProjectId: null, notes: [], currentPhase: 'import' as Phase }
        : {})
    }))
  },

  setCurrentPhase: (phase) => {
    set({ currentPhase: phase })
    const { activeProjectId } = get()
    if (activeProjectId) {
      window.api.getProject(activeProjectId).then((p) => {
        if (p) {
          window.api.updateProject({ ...p, currentPhase: phase })
        }
      })
    }
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  saveSettings: async (settings) => {
    await window.api.saveSettings(settings)
    set({ settings })
  },

  loadNotes: async (projectId) => {
    const notes = await window.api.getNotes(projectId)
    set({ notes })
  },

  importNotes: async () => {
    const { activeProjectId } = get()
    if (!activeProjectId) return []
    set({ isLoading: true, loadingMessage: 'Importing notes...' })
    try {
      const imported = await window.api.importNotes(activeProjectId)
      if (imported.length > 0) {
        await get().loadNotes(activeProjectId)
      }
      return imported
    } finally {
      set({ isLoading: false, loadingMessage: '' })
    }
  },

  updateNote: async (note) => {
    await window.api.updateNote(note)
    set((s) => ({ notes: s.notes.map((n) => (n.id === note.id ? note : n)) }))
  },

  deleteNote: async (noteId) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    await window.api.deleteNote(activeProjectId, noteId)
    set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) }))
  },

  loadPhaseData: async (projectId) => {
    const [clusterData, structureData, detailData] = await Promise.all([
      window.api.getPhaseData<PhaseClusterData>(projectId, 'cluster'),
      window.api.getPhaseData<PhaseStructureData>(projectId, 'structure'),
      window.api.getPhaseData<PhaseDetailData>(projectId, 'detail')
    ])
    set({
      phaseClusterData: clusterData,
      phaseStructureData: structureData,
      phaseDetailData: detailData
    })
  },

  savePhaseClusterData: async (data) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    await window.api.savePhaseData(activeProjectId, 'cluster', data)
    set({ phaseClusterData: data })
  },

  savePhaseStructureData: async (data) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    await window.api.savePhaseData(activeProjectId, 'structure', data)
    set({ phaseStructureData: data })
  },

  savePhaseDetailData: async (data) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    await window.api.savePhaseData(activeProjectId, 'detail', data)
    set({ phaseDetailData: data })
  },

  setLoading: (loading, message = '') => set({ isLoading: loading, loadingMessage: message })
}))
