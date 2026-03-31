# NoteWeave

Transform scattered notes into a well-organized book outline using AI.

NoteWeave is a desktop application that ingests your research notes — Markdown, Word documents, PDFs, and plain text — then guides you through an AI-assisted, multi-phase workflow to produce a detailed, chapter-by-chapter book outline ready for writing.

## Features

- **Create and import notes** — write new notes directly in-app or import `.md`, `.docx`, `.pdf`, and `.txt` files
- **Universal markdown format** — all imported notes are converted to Markdown for consistent viewing and editing
- **Built-in note editor** — view rendered Markdown or switch to raw edit mode; changes auto-clear stale AI summaries
- **Multi-provider AI** — bring your own API key for OpenAI, Anthropic (Claude), or Google Gemini
- **5-phase guided workflow** with user approval at every stage:
  1. **Extract & Summarize** — AI summarizes each note and surfaces key themes
  2. **Cluster & Categorize** — AI groups notes into thematic clusters; rearrange as needed
  3. **Structure** — AI proposes chapter ordering and titles; reorder and rename freely
  4. **Detail** — AI generates a full outline per chapter with sections, key points, and source traceability
  5. **Export** — save the finished outline as Markdown, PDF, or Word
- **Multiple projects** — work on several book outlines simultaneously
- **Fully local** — all data stored on your machine (`~/.noteweave/`); the only network calls are to your chosen AI provider
- **Dark / Light / System theme** support
- **Re-runnable phases** — go back and adjust clusters or structure without re-importing notes

## Prerequisites

- **Node.js** >= 18 (tested with 20+)
- **npm** >= 9
- An API key from at least one supported provider (see [API Key Setup](#api-key-setup))

## Install

```bash
git clone <repo-url> note-weave
cd note-weave
npm install
```

## Run (development)

```bash
npm run dev
```

This starts the Electron app in development mode with hot-reload for the renderer.

## Build (production)

```bash
npm run build
```

Compiled output is written to `out/`. You can then package with a tool like [electron-builder](https://www.electron.build/) if you want a distributable `.dmg` / `.exe` / `.AppImage`.

## API Key Setup

NoteWeave needs an API key from one of the supported AI providers. No key is required to import notes and explore the UI — you only need one when running AI extraction, clustering, structuring, or detail generation.

### Supported providers

| Provider | Where to get a key | Example models |
|---|---|---|
| **OpenAI** | https://platform.openai.com/api-keys | `gpt-4o`, `gpt-4o-mini`, `o1` |
| **Anthropic** | https://console.anthropic.com/settings/keys | `claude-sonnet-4-20250514`, `claude-opus-4-20250514` |
| **Google Gemini** | https://aistudio.google.com/apikey | `gemini-2.0-flash`, `gemini-2.5-pro-preview-05-06` |

### Configuring your key

1. Open NoteWeave
2. Click the **gear icon** in the top-left corner of the sidebar
3. In the Settings dialog:
   - Select your **AI provider** (OpenAI / Anthropic / Google Gemini)
   - Paste your **API key**
   - Choose a **model** from the dropdown
4. Click **Save**

Your key is stored locally in `~/.noteweave/settings.json` and is never sent anywhere except the provider's own API endpoint. All API calls are made from Electron's main process — the key never touches the browser renderer.

> **Tip:** If you want OS-level encryption for the stored key, that's a planned future enhancement using Electron's `safeStorage` API.

## Workflow Overview

```
┌──────────────┐     ┌──────────────┐     ┌───────────┐     ┌──────────┐     ┌────────┐
│ 1. Extract & │────▶│ 2. Cluster & │────▶│ 3. Struct- │────▶│ 4. Detail│────▶│5.Export │
│  Summarize   │     │  Categorize  │     │    ure     │     │          │     │        │
└──────────────┘     └──────────────┘     └───────────┘     └──────────┘     └────────┘
   AI summaries       Group by theme      Order chapters     Full outline      MD/PDF/
   Key themes         Rename/merge        Rename/reorder     per chapter       DOCX
   Review/edit        Drag between        Add/remove         Edit sections
```

Each phase requires your explicit approval before advancing. You can always go back and re-run an earlier phase.

## Project Structure

```
note-weave/
├── electron/              # Main process (Node.js)
│   ├── main.ts            # Window management, IPC handlers
│   ├── preload.ts         # Secure context bridge
│   └── services/
│       ├── ai-providers/  # OpenAI, Anthropic, Google adapters
│       ├── project-store.ts
│       ├── file-parser.ts
│       ├── chunker.ts
│       └── exporter.ts
├── src/                   # Renderer process (React)
│   ├── components/
│   │   ├── layout/        # Sidebar, TopBar, MainPanel
│   │   ├── phases/        # One component per workflow phase
│   │   └── settings/      # Settings dialog
│   └── store/             # Zustand state management
├── shared/                # TypeScript types shared across processes
├── prompts/               # AI prompt templates (editable .md files)
└── package.json
```

## Data Storage

All project data is stored under `~/.noteweave/`:

```
~/.noteweave/
├── settings.json          # API keys, model selection, theme preference
└── projects/
    └── <project-id>/
        ├── project.json   # Project metadata and current phase
        ├── notes/         # One JSON file per imported note
        ├── phase-cluster.json
        ├── phase-structure.json
        └── phase-detail.json
```

## License

MIT
