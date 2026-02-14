# WebForge

**AI-Powered Component Injector — Enhance any website with custom UI components**

WebForge is a Chrome extension that lets you create and inject custom React components, JavaScript scripts, CSS styles, and background workers into any website using AI. Describe what you want in natural language; the AI agent generates code, deploys it to the page (or runs it in a persistent worker), and re-injects it automatically on every visit to matching URLs.

---

## Table of Contents

- [About This Project](#about-this-project)
- [The Idea](#the-idea)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [UI Overview](#ui-overview)
- [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Tech Stack](#tech-stack)
  - [Monorepo Layout](#monorepo-layout)
  - [Extension Manifest (MV3)](#extension-manifest-mv3)
  - [Message Passing](#message-passing)
  - [Data Layer](#data-layer)
  - [AI Agent System](#ai-agent-system)
  - [Background Workers & Offscreen](#background-workers--offscreen)
  - [Content Script Injection](#content-script-injection)
- [Supported AI Providers](#supported-ai-providers)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Production Build](#production-build)
  - [Firefox Support](#firefox-support)
- [Usage](#usage)
- [Package Reference](#package-reference)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## About This Project

This repository is a **Chrome extension monorepo** for **WebForge**. It is built as a **Turborepo** with **pnpm workspaces**: the extension shell lives in `chrome-extension/`, user-facing pages (popup, side panel) and background pages (content script, offscreen, sandbox) live under `pages/`, and shared logic lives in `packages/`. The extension uses **Manifest V3**, a **service worker** for the background, and the **side panel** as the main UI. All persistent data is stored in **IndexedDB** via **Dexie**; AI is orchestrated with **LangChain** and **LangGraph**, and the agent can generate **React components**, **JS scripts**, **CSS**, and **background workers** that run in an offscreen document.

---

## The Idea

Modern websites are not always built the way you need them to be. Maybe you want a dark mode toggle on a site that doesn't have one, a word counter on a text editor, a price tracker overlay on a shopping page, or a custom dashboard widget on your project management tool.

WebForge makes this possible without writing code yourself. You open the side panel, tell the AI what you want ("Add a floating timer to the bottom-right corner"), pick a target element on the page, and the AI generates a fully functional React component, JavaScript snippet, or CSS rule. It gets injected into the page instantly, and WebForge remembers it — re-injecting it automatically every time you visit a matching URL.

You work by creating **extensions** (scoped to URL patterns). Each extension can have multiple **artifacts**: React components, JS scripts, CSS, or **background workers**. The AI agent (LangGraph) handles the full lifecycle: planning, generating, deploying, and verifying artifacts. Background workers run in a persistent offscreen document and can react to storage changes or run on a schedule.

---

## Key Features

- **AI-powered generation** — Describe UI components or scripts in plain English; the AI writes the code.
- **Multi-provider AI support** — OpenAI, Anthropic, and Google Gemini with configurable models.
- **Autonomous agent workflow** — A LangGraph-based agent that can plan, generate, edit, deploy, inspect, and verify artifacts without manual intervention.
- **Live injection** — React components, JavaScript (IIFE), and CSS are injected directly into pages in real time.
- **URL pattern matching** — Artifacts auto-inject on matching pages using wildcard URL patterns (e.g., `https://*.github.com/*`).
- **Element picker** — Visual CSS selector picker to target specific DOM elements for injection.
- **DOM inspection tools** — The agent can inspect DOM structure, read page text, and query computed styles to make informed decisions.
- **Background workers** — The agent can generate background-worker artifacts that run in Chrome's offscreen document, with access to extension storage and optional triggers (e.g. storage change, interval).
- **Persistent storage** — All extensions, artifacts, conversations, and settings are stored locally in IndexedDB via Dexie.
- **Version history** — Artifacts maintain version history with rollback support.
- **Per-component data** — Injected components can persist key-value data per component per URL via context.
- **Side panel UI** — A single interface in Chrome's side panel: extension list, per-extension chat + artifacts, and AI provider settings.

---

## How It Works

1. **Open WebForge** — Click the extension icon or use the popup to open the side panel.
2. **Create an Extension** — Give it a name, URL pattern, and description.
3. **Chat with the Agent** — Describe what you want. The agent uses tools to:
   - Inspect the current page's DOM and styles
   - Generate React components, JS scripts, CSS, or background workers
   - Deploy artifacts to the page (or start background workers in the offscreen document)
   - Verify that the deployment worked correctly
4. **Automatic re-injection** — When you navigate to a matching URL, the service worker re-injects all enabled page artifacts; background workers keep running until you stop them.

---

## UI Overview

The extension UI is split between a **popup** and the **side panel**.

| Surface | Purpose |
|--------|--------|
| **Popup** | Shown when you click the extension icon. Contains the app name and an "Open Side Panel" button. Clicking the icon can also open the side panel directly (via `openPanelOnActionClick`). |
| **Side panel** | Main interface. Always available when the extension is loaded; open it from the popup or toolbar. |

### Side panel layout

- **Header** — Shows "WebForge" and anchors the main tabs.
- **Main tabs**
  - **Extensions** — List of all extensions (name, URL pattern, description). Each card has an enable/disable toggle and delete. You can create a new extension with name, URL pattern (e.g. `https://*.github.com/*`), and optional description. Selecting an extension opens its **detail view**.
  - **Settings** — AI provider (OpenAI, Anthropic, Google), API key(s), and model selection. Settings are persisted in IndexedDB.

### Extension detail view

When you open an extension from the list:

- **Header** — Back button, extension name, and URL pattern.
- **Sub-tabs**
  - **Chat** — Agent chat panel. You type what you want (e.g. "Add a floating timer"); the agent uses tools to inspect the page, generate artifacts (React, JS, CSS, or background worker), deploy them, and verify. Messages show user/assistant bubbles and expandable tool-call blocks (name, args, result, status).
  - **Artifacts** — List of all artifacts for this extension. Each artifact card shows type (react-component, js-script, css, background-worker), name, and actions: deploy to page, remove from page, and for background workers: start / stop / reload. Worker status (running, error) is shown when applicable.

### Content script (no visible UI by default)

The content script runs on every `http`/`https` page. It does not show UI unless the agent deploys an artifact or activates the element picker. It handles: URL-based auto-loading of extensions, injection/removal of artifacts, DOM serialization, style inspection, page text reading, deployment verification, and forwarding worker messages to injected React components via `webforge-worker-message` custom events.

---

## Architecture

### Project Structure

```
signpdf/
├── chrome-extension/          # Extension entry point
│   ├── manifest.ts            # MV3 manifest definition (compiled at build time)
│   ├── src/background/        # Background service worker (message router, DB, agent, URL matcher, worker manager, offscreen)
│   └── public/                # Icons and static assets
├── pages/                     # Extension pages and scripts
│   ├── popup/                 # Toolbar popup — "Open Side Panel" entry point
│   ├── side-panel/            # Main UI — Extensions list, Extension detail (Chat + Artifacts), Settings
│   ├── content/               # Content script (matches all http/https) — injector, DOM tools, picker
│   ├── offscreen/             # Offscreen document — runs background-worker artifacts with DOM/API access
│   └── sandbox/               # Sandboxed page for isolated script execution (if used)
├── packages/                  # Shared internal packages
│   ├── shared/                # Types, Dexie DB, migrations, AI providers, LangGraph agent, HOCs, hooks, utils
│   ├── env/                   # Environment variable management (CEB_*)
│   ├── storage/               # Chrome storage API helpers
│   ├── hmr/                   # Hot Module Rebuild plugin for development
│   ├── i18n/                  # Internationalization (en, ko, etc.)
│   ├── ui/                    # Shared UI (LoadingSpinner, ToggleButton, ErrorDisplay)
│   ├── vite-config/           # Shared Vite config for pages and content scripts
│   ├── tailwindcss-config/    # Shared Tailwind CSS config
│   ├── tsconfig/               # Base/app/module TypeScript configs
│   ├── dev-utils/             # Manifest parser, build utilities
│   ├── module-manager/        # CLI to enable/disable extension modules
│   └── zipper/                # Package dist into a zip for distribution
└── dist/                      # Build output — load this directory in Chrome as unpacked extension
```

### Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js >= 22.15.1 |
| Package Manager | pnpm 10.11.0 |
| Monorepo | Turborepo |
| Build | Vite 6 + Rollup |
| Frontend | React 19 |
| Styling | Tailwind CSS 3 |
| Local Database | Dexie (IndexedDB wrapper) |
| AI Orchestration | LangChain + LangGraph |
| AI Providers | OpenAI, Anthropic, Google GenAI |
| Code Transform | Sucrase (JSX transpilation at runtime) |
| Extension APIs | Manifest V3, side panel, offscreen document, scripting |
| Linting | ESLint + Prettier |
| Testing | WebdriverIO (E2E) |

### Monorepo Layout

The project uses **pnpm workspaces** with **Turborepo** for orchestrating builds across packages. Each package under `packages/` and `pages/` is an independent workspace with its own `package.json` and `tsconfig.json`. Turborepo handles dependency ordering, caching, and parallel execution.

Key scripts:
- `pnpm dev` — Start development with HMR and watch mode
- `pnpm build` — Production build into `dist/`
- `pnpm zip` — Build and package into a distributable zip
- `pnpm lint` — Lint all packages
- `pnpm module-manager` — Interactive tool to enable/disable modules

### Extension Manifest (MV3)

The manifest is defined in `chrome-extension/manifest.ts` and compiled at build time. Key permissions and features:

- **Permissions:** `storage`, `scripting`, `tabs`, `activeTab`, `sidePanel`, `offscreen`
- **Host permissions:** `<all_urls>` (for injecting into any page)
- **Background:** ES module service worker
- **Content scripts:** One script (`content/all.iife.js`) on all `http://` and `https://` pages
- **Side panel:** Default path `side-panel/index.html`; open via action click or popup
- **Sandbox:** Optional sandbox page for isolated execution
- **Web-accessible resources:** JS, CSS, SVG, icons, sandbox page

### Message Passing

Communication between the side panel, background service worker, and content scripts uses Chrome's `runtime.sendMessage` / `onMessage` API with a typed message router pattern:

```
Side Panel ──sendMessage──▶ Background Service Worker ──sendMessage──▶ Content Script
         │                              │
         │                              ├── sendMessage ──▶ Offscreen (run background workers)
         │                              ├── Extension/Artifact CRUD (Dexie)
         │                              ├── Settings, component data
         │                              ├── Agent orchestration (LangGraph)
         │                              ├── Start/stop/reload background workers
         │                              └── chrome.scripting (inject into tabs)
```

The background service worker is the central hub: it handles DB, AI, agent runs, and talks to the content script (injection, DOM tools) and the offscreen document (background workers).

### Data Layer

All persistent data lives in **IndexedDB** via **Dexie**, organized into these stores:

| Store | Purpose |
|-------|--------|
| `components` | Legacy single-component definitions (migrated into extensions/artifacts) |
| `extensions` | Extension metadata (name, URL pattern, description, enabled) |
| `artifacts` | Artifacts per extension: `react-component`, `js-script`, `css`, `background-worker` (code, selector, versions) |
| `conversations` | Legacy chat history; agent chat is stored per extension in agent checkpoints |
| `componentData` | Per-component, per-URL key-value storage for injected components |
| `settings` | AI provider, model, API keys |
| `agentCheckpoints` / `agentCheckpointWrites` | LangGraph agent state (resumable conversations) |
| `extensionSchemas` | Optional schema/config per extension (e.g. for background worker triggers) |

A migration (`migrateV1ToV2`) converts legacy components into the extension/artifact model on startup.

### AI Agent System

The agent is built on **LangGraph** with a `StateGraph` containing two core nodes:

1. **`orchestrator`** — The LLM-powered reasoning node that decides which tools to call
2. **`tool_executor`** — Executes the selected tool and returns results

Available agent tools:

| Tool | Description |
|------|-------------|
| `generate_react_component` | Generate a new React component from a description |
| `generate_js` | Generate a JavaScript snippet |
| `generate_css` | Generate CSS rules |
| `generate_background_worker` | Generate a background-worker artifact (runs in offscreen document) |
| `edit_artifact` | Modify an existing artifact's code |
| `deploy_artifact` | Inject artifact into the current page (or start a background worker in offscreen) |
| `verify_deployment` | Check if the deployed artifact is visible and working |
| `inspect_dom` | Serialize and read the page's DOM structure |
| `inspect_styles` | Query computed styles of specific elements |
| `read_page_text` | Extract text content from the page |
| `pick_element` | Activate the visual element picker |
| `remove_artifact` | Remove a deployed artifact from the page |

The agent state is persisted to IndexedDB via a custom Dexie-backed checkpointer, so conversations can be resumed across sessions.

### Background Workers & Offscreen

Artifacts of type **background-worker** are JavaScript that runs in a persistent **offscreen document** (Chrome's Offscreen API), not in the content script. The service worker ensures the offscreen document is created when needed and sends `START_WORKER`, `STOP_WORKER`, `RELOAD_WORKER`, and `GET_STATUSES` to it. Workers can use extension APIs and optional triggers (e.g. storage change, interval). The UI (Artifacts tab) shows run/stop/reload and status (running/error). Worker code is executed in the offscreen page context; the side panel and content script communicate with the service worker, which proxies to the offscreen document when handling worker lifecycle or API calls from workers.

### Content Script Injection

WebForge injects code into pages through multiple mechanisms:

1. **React components** — A React runtime (`React` + `ReactDOM`) is injected into the page's `MAIN` world as `window.__WEBFORGE__`. Components are written as JSX, transpiled with **Sucrase** at runtime, and rendered into dynamically created mount points.

2. **JavaScript scripts** — Plain JS wrapped as IIFEs, executed in the page's `MAIN` world via `chrome.scripting.executeScript`.

3. **CSS** — Style rules injected as `<style>` elements in the page.

4. **Component context** — Each injected component receives a `context` object with:
   - `getData()` / `setData()` — Persistent key-value storage per component per URL
   - `pageUrl` — The current page URL

The content script also provides:
- **Element picker** — Highlights elements on hover and returns CSS selectors on click
- **DOM serialization** — Converts DOM subtrees into a readable format for the AI agent
- **Style inspection** — Reads computed styles for specific CSS properties
- **Deployment verification** — Checks if injected elements exist in the DOM

---

## Supported AI Providers

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| **Anthropic** | claude-sonnet-4-20250514, claude-haiku-4-20250414 |
| **Google** | gemini-2.0-flash, gemini-2.5-pro, gemini-2.5-flash |

Configure your preferred provider and API key in the **Settings** tab of the side panel.

---

## Getting Started

### Prerequisites

- **Node.js** >= 22.15.1 (see `.nvmrc`)
- **pnpm** 10.11.0 — Install with `npm install -g pnpm`
- **Chrome** (or Firefox for limited support)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd signpdf

# Install dependencies
pnpm install
```

### Development

```bash
# Start dev server with HMR
pnpm dev
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` directory

The extension will hot-reload as you make changes.

### Production Build

```bash
# Build for production
pnpm build

# Build and create distributable zip
pnpm zip
```

### Firefox Support

```bash
# Development
pnpm dev:firefox

# Production build
pnpm build:firefox
```

Load as a temporary add-on from `about:debugging#/runtime/this-firefox`.

---

## Usage

1. **Open the extension** — Click the WebForge icon; the side panel opens (or open it via the popup).
2. **Configure AI** — In **Settings**, choose provider (OpenAI, Anthropic, Google), enter API key(s), and select a model. Save.
3. **Create an extension** — In **Extensions**, click "New Extension", set name and URL pattern (e.g. `https://*.github.com/*`), optionally description, then Create.
4. **Chat with the agent** — Open an extension to see **Chat** and **Artifacts**. In Chat, describe what you want (e.g. "Add a dark mode toggle"). The agent will inspect the page, generate artifacts (React, JS, CSS, or background worker), deploy them, and verify.
5. **Manage artifacts** — In **Artifacts**, deploy or remove artifacts from the page; for background workers, start, stop, or reload and see status.

---

## Package Reference

| Package | Description |
|---|---|
| `@extension/shared` | Core types, Dexie DB (schema, migrations), AI providers & prompts, LangGraph agent (tools, runner), HOCs, hooks, utils |
| `@extension/env` | Environment variable management with typed config (`CEB_*` prefix) |
| `@extension/storage` | Chrome storage API wrappers for local/session storage |
| `@extension/hmr` | Custom Hot Module Rebuild plugin for Vite with reload/refresh injection |
| `@extension/i18n` | Type-safe internationalization with locale validation |
| `@extension/ui` | Shared UI components (LoadingSpinner, ToggleButton, ErrorDisplay) |
| `@extension/vite-config` | Shared Vite configuration for pages and content scripts |
| `@extension/tailwindcss-config` | Shared Tailwind CSS configuration |
| `@extension/tsconfig` | Shared TypeScript configs (base, app, module) |
| `@extension/dev-utils` | Manifest parser, logger, and build utilities |
| `module-manager` | CLI tool to enable/disable extension modules |
| `zipper` | Build and zip the `dist` folder for distribution |

---

## Environment Variables

Environment variables use the `CEB_` prefix and are managed through `.env` files. See [packages/env/README.md](packages/env/README.md) for full documentation.

```bash
# Copy the example env file
pnpm copy-env

# Set variables via CLI
pnpm set-global-env KEY=value
```

---

## License

This project is licensed under the [MIT License](LICENSE).
