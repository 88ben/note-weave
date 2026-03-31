import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { Note } from '../../shared/types'

export class FileParser {
  async parseFile(filePath: string, projectId: string): Promise<Note> {
    const ext = path.extname(filePath).toLowerCase().slice(1)
    const filename = path.basename(filePath)
    let content: string

    switch (ext) {
      case 'md':
      case 'txt':
        content = await fs.readFile(filePath, 'utf-8')
        break
      case 'docx':
        content = await this.parseDocx(filePath)
        break
      case 'pdf':
        content = await this.parsePdf(filePath)
        break
      default:
        content = await fs.readFile(filePath, 'utf-8')
    }

    const format = (['md', 'docx', 'pdf', 'txt'].includes(ext) ? ext : 'txt') as Note['originalFormat']

    return {
      id: uuidv4(),
      projectId,
      filename,
      originalFormat: format,
      content,
      extractApproved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  private async parseDocx(filePath: string): Promise<string> {
    const mammoth = await import('mammoth')
    const buffer = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  private async parsePdf(filePath: string): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default
    const buffer = await fs.readFile(filePath)
    const result = await pdfParse(buffer)
    return result.text
  }
}
