export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  currentPhase: Phase
}

export type Phase = 'import' | 'extract' | 'cluster' | 'structure' | 'detail' | 'export'

export const PHASE_ORDER: Phase[] = ['import', 'extract', 'cluster', 'structure', 'detail', 'export']

export const PHASE_LABELS: Record<Phase, string> = {
  import: 'Extract & Summarize',
  extract: 'Extract & Summarize',
  cluster: 'Cluster & Categorize',
  structure: 'Structure',
  detail: 'Detail',
  export: 'Export'
}

export interface Note {
  id: string
  projectId: string
  filename: string
  originalFormat: 'md' | 'docx' | 'pdf' | 'txt'
  content: string
  summary?: string
  themes?: string[]
  extractApproved: boolean
  createdAt: string
  updatedAt: string
}

export interface ThemeCluster {
  id: string
  name: string
  description: string
  noteIds: string[]
}

export interface PhaseClusterData {
  clusters: ThemeCluster[]
  approved: boolean
  generatedAt: string
  approvedAt?: string
}

export interface Chapter {
  id: string
  title: string
  description: string
  order: number
  clusterIds: string[]
  noteIds: string[]
}

export interface PhaseStructureData {
  chapters: Chapter[]
  approved: boolean
  generatedAt: string
  approvedAt?: string
}

export interface OutlineSection {
  id: string
  title: string
  level: number
  keyPoints: string[]
  sourceNoteIds: string[]
  transition?: string
  children: OutlineSection[]
}

export interface ChapterOutline {
  chapterId: string
  chapterTitle: string
  sections: OutlineSection[]
}

export interface PhaseDetailData {
  chapterOutlines: ChapterOutline[]
  approved: boolean
  generatedAt: string
  approvedAt?: string
}

export type AIProviderType = 'openai' | 'anthropic' | 'google'

export interface AIProviderConfig {
  type: AIProviderType
  apiKey: string
  model: string
}

export interface AppSettings {
  aiProvider: AIProviderConfig
  dataDirectory: string
  theme: 'light' | 'dark' | 'system'
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
}

export type ExportFormat = 'md' | 'pdf' | 'docx'

export interface IpcApi {
  // Project operations
  getProjects(): Promise<Project[]>
  createProject(name: string, description: string): Promise<Project>
  deleteProject(id: string): Promise<void>
  getProject(id: string): Promise<Project>
  updateProject(project: Project): Promise<void>

  // Note operations
  importNotes(projectId: string): Promise<Note[]>
  createNote(projectId: string, title: string): Promise<Note>
  getNotes(projectId: string): Promise<Note[]>
  updateNote(note: Note): Promise<void>
  deleteNote(projectId: string, noteId: string): Promise<void>
  getNoteContent(projectId: string, noteId: string): Promise<string>

  // AI operations
  aiChat(messages: Message[], providerConfig: AIProviderConfig): Promise<AIResponse>
  aiStream(messages: Message[], providerConfig: AIProviderConfig): Promise<string>

  // Phase data operations
  getPhaseData<T>(projectId: string, phase: string): Promise<T | null>
  savePhaseData<T>(projectId: string, phase: string, data: T): Promise<void>

  // Settings
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>

  // Export
  exportOutline(projectId: string, format: ExportFormat): Promise<string>

  // File dialogs
  showSaveDialog(defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<string | null>
}
