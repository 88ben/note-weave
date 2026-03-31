import fs from 'fs/promises'
import type {
  Project,
  Note,
  PhaseDetailData,
  PhaseStructureData,
  OutlineSection,
  ExportFormat
} from '../../shared/types'

interface ExportParams {
  format: ExportFormat
  filePath: string
  project: Project
  notes: Note[]
  detailData: PhaseDetailData
  structureData: PhaseStructureData | null
}

export class Exporter {
  async export(params: ExportParams): Promise<void> {
    switch (params.format) {
      case 'md':
        return this.exportMarkdown(params)
      case 'pdf':
        return this.exportPdf(params)
      case 'docx':
        return this.exportDocx(params)
    }
  }

  private async exportMarkdown(params: ExportParams): Promise<void> {
    const lines: string[] = []
    lines.push(`# ${params.project.name}`)
    lines.push('')
    if (params.project.description) {
      lines.push(`> ${params.project.description}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')

    for (const chapter of params.detailData.chapterOutlines) {
      lines.push(`## ${chapter.chapterTitle}`)
      lines.push('')
      for (const section of chapter.sections) {
        this.renderMarkdownSection(section, lines, 3)
      }
      lines.push('')
    }

    const noteMap = new Map(params.notes.map((n) => [n.id, n]))
    const referencedNoteIds = new Set<string>()
    for (const chapter of params.detailData.chapterOutlines) {
      for (const section of chapter.sections) {
        this.collectNoteIds(section, referencedNoteIds)
      }
    }

    if (referencedNoteIds.size > 0) {
      lines.push('---')
      lines.push('')
      lines.push('## Source Notes')
      lines.push('')
      for (const noteId of referencedNoteIds) {
        const note = noteMap.get(noteId)
        if (note) {
          lines.push(`- **${note.filename}**: ${note.summary || '(no summary)'}`)
        }
      }
    }

    await fs.writeFile(params.filePath, lines.join('\n'), 'utf-8')
  }

  private renderMarkdownSection(
    section: OutlineSection,
    lines: string[],
    headingLevel: number
  ): void {
    const prefix = '#'.repeat(Math.min(headingLevel, 6))
    lines.push(`${prefix} ${section.title}`)
    lines.push('')

    if (section.keyPoints.length > 0) {
      for (const point of section.keyPoints) {
        lines.push(`- ${point}`)
      }
      lines.push('')
    }

    if (section.transition) {
      lines.push(`*${section.transition}*`)
      lines.push('')
    }

    for (const child of section.children) {
      this.renderMarkdownSection(child, lines, headingLevel + 1)
    }
  }

  private collectNoteIds(section: OutlineSection, ids: Set<string>): void {
    for (const id of section.sourceNoteIds) {
      ids.add(id)
    }
    for (const child of section.children) {
      this.collectNoteIds(child, ids)
    }
  }

  private async exportDocx(params: ExportParams): Promise<void> {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = await import(
      'docx'
    )

    const children: InstanceType<typeof Paragraph>[] = []

    children.push(
      new Paragraph({
        text: params.project.name,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    )

    if (params.project.description) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: params.project.description, italics: true })],
          spacing: { after: 400 }
        })
      )
    }

    for (const chapter of params.detailData.chapterOutlines) {
      children.push(
        new Paragraph({
          text: chapter.chapterTitle,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      )

      for (const section of chapter.sections) {
        this.renderDocxSection(section, children, 2, {
          Paragraph,
          HeadingLevel,
          TextRun
        })
      }
    }

    const doc = new Document({
      sections: [{ children }]
    })

    const buffer = await Packer.toBuffer(doc)
    await fs.writeFile(params.filePath, buffer)
  }

  private renderDocxSection(
    section: OutlineSection,
    children: any[],
    level: number,
    docx: any
  ): void {
    const headingLevels = [
      docx.HeadingLevel.HEADING_1,
      docx.HeadingLevel.HEADING_2,
      docx.HeadingLevel.HEADING_3,
      docx.HeadingLevel.HEADING_4,
      docx.HeadingLevel.HEADING_5
    ]
    const heading = headingLevels[Math.min(level - 1, headingLevels.length - 1)]

    children.push(
      new docx.Paragraph({
        text: section.title,
        heading,
        spacing: { before: 200, after: 100 }
      })
    )

    for (const point of section.keyPoints) {
      children.push(
        new docx.Paragraph({
          children: [new docx.TextRun({ text: `• ${point}` })],
          spacing: { after: 60 }
        })
      )
    }

    if (section.transition) {
      children.push(
        new docx.Paragraph({
          children: [new docx.TextRun({ text: section.transition, italics: true })],
          spacing: { after: 100 }
        })
      )
    }

    for (const child of section.children) {
      this.renderDocxSection(child, children, level + 1, docx)
    }
  }

  private async exportPdf(params: ExportParams): Promise<void> {
    const markdown = await this.generateMarkdownString(params)
    const html = this.markdownToHtml(markdown, params.project.name)
    const tmpHtmlPath = params.filePath.replace(/\.pdf$/, '.tmp.html')
    await fs.writeFile(tmpHtmlPath, html, 'utf-8')

    const { BrowserWindow } = await import('electron')
    const win = new BrowserWindow({ show: false, width: 800, height: 600 })
    await win.loadFile(tmpHtmlPath)

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })

    await fs.writeFile(params.filePath, pdfData)
    win.close()
    await fs.unlink(tmpHtmlPath).catch(() => {})
  }

  private async generateMarkdownString(params: ExportParams): Promise<string> {
    const lines: string[] = []
    lines.push(`# ${params.project.name}`)
    lines.push('')

    for (const chapter of params.detailData.chapterOutlines) {
      lines.push(`## ${chapter.chapterTitle}`)
      lines.push('')
      for (const section of chapter.sections) {
        this.renderMarkdownSection(section, lines, 3)
      }
    }

    return lines.join('\n')
  }

  private markdownToHtml(md: string, title: string): string {
    let html = md
      .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
      .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<br/><br/>')

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a1a}
h1{font-size:28px;border-bottom:2px solid #eee;padding-bottom:8px}
h2{font-size:22px;margin-top:32px}h3{font-size:18px}h4{font-size:16px}
li{margin:4px 0;margin-left:20px}em{color:#555}</style></head><body>${html}</body></html>`
  }
}
