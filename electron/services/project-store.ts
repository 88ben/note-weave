import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { Project, Note, AppSettings } from '../../shared/types'

export class ProjectStore {
  private baseDir: string

  constructor() {
    this.baseDir = path.join(app.getPath('home'), '.noteweave')
    this.ensureDir(this.baseDir)
    this.ensureDir(path.join(this.baseDir, 'projects'))
  }

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
  }

  private projectDir(projectId: string): string {
    return path.join(this.baseDir, 'projects', projectId)
  }

  private notesDir(projectId: string): string {
    return path.join(this.projectDir(projectId), 'notes')
  }

  async getProjects(): Promise<Project[]> {
    const projectsDir = path.join(this.baseDir, 'projects')
    await this.ensureDir(projectsDir)
    const entries = await fs.readdir(projectsDir, { withFileTypes: true })
    const projects: Project[] = []

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const data = await fs.readFile(
            path.join(projectsDir, entry.name, 'project.json'),
            'utf-8'
          )
          projects.push(JSON.parse(data))
        } catch {
          // skip invalid project dirs
        }
      }
    }

    return projects.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  async createProject(name: string, description: string): Promise<Project> {
    const project: Project = {
      id: uuidv4(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentPhase: 'import'
    }

    const dir = this.projectDir(project.id)
    await this.ensureDir(dir)
    await this.ensureDir(path.join(dir, 'notes'))
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(project, null, 2))

    return project
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const data = await fs.readFile(
        path.join(this.projectDir(id), 'project.json'),
        'utf-8'
      )
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  async updateProject(project: Project): Promise<void> {
    project.updatedAt = new Date().toISOString()
    await fs.writeFile(
      path.join(this.projectDir(project.id), 'project.json'),
      JSON.stringify(project, null, 2)
    )
  }

  async deleteProject(id: string): Promise<void> {
    await fs.rm(this.projectDir(id), { recursive: true, force: true })
  }

  async getNotes(projectId: string): Promise<Note[]> {
    const dir = this.notesDir(projectId)
    await this.ensureDir(dir)
    const files = await fs.readdir(dir)
    const notes: Note[] = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = await fs.readFile(path.join(dir, file), 'utf-8')
          notes.push(JSON.parse(data))
        } catch {
          // skip invalid
        }
      }
    }

    return notes.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  async getNote(projectId: string, noteId: string): Promise<Note | null> {
    try {
      const data = await fs.readFile(
        path.join(this.notesDir(projectId), `${noteId}.json`),
        'utf-8'
      )
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  async saveNote(note: Note): Promise<void> {
    note.updatedAt = new Date().toISOString()
    await this.ensureDir(this.notesDir(note.projectId))
    await fs.writeFile(
      path.join(this.notesDir(note.projectId), `${note.id}.json`),
      JSON.stringify(note, null, 2)
    )
  }

  async deleteNote(projectId: string, noteId: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.notesDir(projectId), `${noteId}.json`))
    } catch {
      // file may not exist
    }
  }

  async getPhaseData<T>(projectId: string, phase: string): Promise<T | null> {
    try {
      const data = await fs.readFile(
        path.join(this.projectDir(projectId), `phase-${phase}.json`),
        'utf-8'
      )
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  async savePhaseData<T>(projectId: string, phase: string, data: T): Promise<void> {
    await fs.writeFile(
      path.join(this.projectDir(projectId), `phase-${phase}.json`),
      JSON.stringify(data, null, 2)
    )
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const data = await fs.readFile(
        path.join(this.baseDir, 'settings.json'),
        'utf-8'
      )
      return JSON.parse(data)
    } catch {
      const defaults: AppSettings = {
        aiProvider: { type: 'openai', apiKey: '', model: 'gpt-4o' },
        dataDirectory: this.baseDir,
        theme: 'system'
      }
      return defaults
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await fs.writeFile(
      path.join(this.baseDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    )
  }
}
