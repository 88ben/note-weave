import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  createProject: (name, description) => ipcRenderer.invoke('create-project', name, description),
  deleteProject: (id) => ipcRenderer.invoke('delete-project', id),
  getProject: (id) => ipcRenderer.invoke('get-project', id),
  updateProject: (project) => ipcRenderer.invoke('update-project', project),

  importNotes: (projectId) => ipcRenderer.invoke('import-notes', projectId),
  createNote: (projectId, title) => ipcRenderer.invoke('create-note', projectId, title),
  getNotes: (projectId) => ipcRenderer.invoke('get-notes', projectId),
  updateNote: (note) => ipcRenderer.invoke('update-note', note),
  deleteNote: (projectId, noteId) => ipcRenderer.invoke('delete-note', projectId, noteId),
  getNoteContent: (projectId, noteId) =>
    ipcRenderer.invoke('get-note-content', projectId, noteId),

  aiChat: (messages, providerConfig) =>
    ipcRenderer.invoke('ai-chat', messages, providerConfig),
  aiStream: (messages, providerConfig) =>
    ipcRenderer.invoke('ai-stream', messages, providerConfig),

  getPhaseData: (projectId, phase) => ipcRenderer.invoke('get-phase-data', projectId, phase),
  savePhaseData: (projectId, phase, data) =>
    ipcRenderer.invoke('save-phase-data', projectId, phase, data),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  exportOutline: (projectId, format) => ipcRenderer.invoke('export-outline', projectId, format),
  showSaveDialog: (defaultName, filters) =>
    ipcRenderer.invoke('show-save-dialog', defaultName, filters)
}

contextBridge.exposeInMainWorld('api', api)
