---
sidebar_position: 3
---

# Architecture

Conjure is built as a **Turborepo monorepo** with **pnpm workspaces**. It uses **Manifest V3**, a **service worker** for the background, and the **side panel** as the main UI.

## Project Structure

```text
conjure/
├── chrome-extension/          # Extension entry point
│   ├── manifest.ts            # MV3 manifest definition
│   ├── src/background/        # Background service worker
│   └── public/                # Icons and static assets
├── pages/                     # Extension pages and scripts
│   ├── popup/                 # Toolbar popup
│   ├── side-panel/            # Main UI
│   ├── content/               # Content script
│   ├── offscreen/             # Offscreen document for background workers
│   └── sandbox/               # Sandboxed page for isolated execution
├── packages/                  # Shared internal packages
│   ├── shared/                # Types, DB, AI providers, LangGraph agent
│   ├── env/                   # Environment variable management
│   ├── storage/               # Chrome storage API helpers
│   ├── ui/                    # Shared UI components
│   └── ...                    # Other shared packages
└── dist/                      # Build output
```

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js >= 22.15.1 |
| Package Manager | pnpm 10.11.0 |
| Monorepo | Turborepo |
| Build | Vite 6 + Rollup |
| Frontend | React 19 |
| Styling | Tailwind CSS 3 |
| Local Database | Dexie (IndexedDB) |
| AI Orchestration | LangChain + LangGraph |
| AI Providers | OpenAI, Anthropic, Google GenAI |

## Message Passing

```text
Side Panel ──sendMessage──▶ Background Service Worker ──sendMessage──▶ Content Script
         │                              │
         │                              ├── sendMessage ──▶ Offscreen (background workers)
         │                              ├── Extension/Artifact CRUD (Dexie)
         │                              ├── Agent orchestration (LangGraph)
         │                              └── chrome.scripting (inject into tabs)
```

## Data Layer

All persistent data lives in **IndexedDB** via **Dexie**:

| Store | Purpose |
|-------|---------|
| `extensions` | Extension metadata (name, URL pattern, description, enabled) |
| `artifacts` | Artifacts per extension: react-component, js-script, css, background-worker |
| `componentData` | Per-component, per-URL key-value storage |
| `settings` | AI provider, model, API keys |
| `agentCheckpoints` | LangGraph agent state (resumable conversations) |

## AI Agent System

The agent is built on **LangGraph** with a `StateGraph` containing two core nodes:

1. **`orchestrator`** — The LLM-powered reasoning node
2. **`tool_executor`** — Executes the selected tool and returns results

### Available Tools

| Tool | Description |
|------|-------------|
| `generate_react_component` | Generate a new React component |
| `generate_js` | Generate a JavaScript snippet |
| `generate_css` | Generate CSS rules |
| `generate_background_worker` | Generate a background-worker artifact |
| `edit_artifact` | Modify an existing artifact's code |
| `deploy_artifact` | Inject artifact into the current page |
| `inspect_dom` | Read the page's DOM structure |
| `inspect_styles` | Query computed styles |
| `read_page_text` | Extract text content from the page |
| `pick_element` | Activate the visual element picker |
| `remove_artifact` | Remove a deployed artifact |
