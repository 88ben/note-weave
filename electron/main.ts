import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { ProjectStore } from './services/project-store'
import { FileParser } from './services/file-parser'
import { createAIProvider } from './services/ai-providers'
import { Exporter } from './services/exporter'
import type { AIProviderConfig, Message, ExportFormat } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let projectStore: ProjectStore
let fileParser: FileParser
let exporter: Exporter

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('get-projects', async () => {
    return projectStore.getProjects()
  })

  ipcMain.handle('create-project', async (_e, name: string, description: string) => {
    return projectStore.createProject(name, description)
  })

  ipcMain.handle('delete-project', async (_e, id: string) => {
    return projectStore.deleteProject(id)
  })

  ipcMain.handle('get-project', async (_e, id: string) => {
    return projectStore.getProject(id)
  })

  ipcMain.handle('update-project', async (_e, project) => {
    return projectStore.updateProject(project)
  })

  ipcMain.handle('import-notes', async (_e, projectId: string) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Documents',
          extensions: ['md', 'txt', 'pdf', 'docx']
        }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return []
    }

    const notes = []
    for (const filePath of result.filePaths) {
      const note = await fileParser.parseFile(filePath, projectId)
      await projectStore.saveNote(note)
      notes.push(note)
    }
    return notes
  })

  ipcMain.handle('get-notes', async (_e, projectId: string) => {
    return projectStore.getNotes(projectId)
  })

  ipcMain.handle('update-note', async (_e, note) => {
    return projectStore.saveNote(note)
  })

  ipcMain.handle('delete-note', async (_e, projectId: string, noteId: string) => {
    return projectStore.deleteNote(projectId, noteId)
  })

  ipcMain.handle('get-note-content', async (_e, projectId: string, noteId: string) => {
    const note = await projectStore.getNote(projectId, noteId)
    return note?.content ?? ''
  })

  ipcMain.handle(
    'ai-chat',
    async (_e, messages: Message[], providerConfig: AIProviderConfig) => {
      const provider = createAIProvider(providerConfig)
      return provider.chat({
        model: providerConfig.model,
        messages,
        temperature: 0.7
      })
    }
  )

  ipcMain.handle(
    'ai-stream',
    async (_e, messages: Message[], providerConfig: AIProviderConfig) => {
      const provider = createAIProvider(providerConfig)
      let result = ''
      for await (const chunk of provider.stream({
        model: providerConfig.model,
        messages,
        temperature: 0.7
      })) {
        result += chunk
      }
      return result
    }
  )

  ipcMain.handle('get-phase-data', async (_e, projectId: string, phase: string) => {
    return projectStore.getPhaseData(projectId, phase)
  })

  ipcMain.handle('save-phase-data', async (_e, projectId: string, phase: string, data: unknown) => {
    return projectStore.savePhaseData(projectId, phase, data)
  })

  ipcMain.handle('get-settings', async () => {
    return projectStore.getSettings()
  })

  ipcMain.handle('save-settings', async (_e, settings) => {
    return projectStore.saveSettings(settings)
  })

  ipcMain.handle('export-outline', async (_e, projectId: string, format: ExportFormat) => {
    const project = await projectStore.getProject(projectId)
    const notes = await projectStore.getNotes(projectId)
    const detailData = await projectStore.getPhaseData(projectId, 'detail')
    const structureData = await projectStore.getPhaseData(projectId, 'structure')

    if (!project || !detailData) {
      throw new Error('Project or outline data not found')
    }

    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `${project.name}-outline.${format}`,
      filters: [
        {
          name: format === 'md' ? 'Markdown' : format === 'pdf' ? 'PDF' : 'Word Document',
          extensions: [format]
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return ''
    }

    await exporter.export({
      format,
      filePath: result.filePath,
      project,
      notes,
      detailData: detailData as any,
      structureData: structureData as any
    })

    return result.filePath
  })

  ipcMain.handle('show-save-dialog', async (_e, defaultName: string, filters) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters
    })
    return result.canceled ? null : result.filePath
  })
}

app.whenReady().then(() => {
  projectStore = new ProjectStore()
  fileParser = new FileParser()
  exporter = new Exporter()

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
