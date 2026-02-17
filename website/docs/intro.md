---
sidebar_position: 1
---

# Introduction

**Conjure** is a Chrome extension that lets you create and inject custom React components, JavaScript scripts, CSS styles, and background workers into any website using AI.

Describe what you want in natural language; the AI agent generates code, deploys it to the page, and re-injects it automatically on every visit to matching URLs.

## Key Features

- **AI-powered generation** — Describe UI components or scripts in plain English; the AI writes the code
- **Multi-provider AI support** — OpenAI, Anthropic, and Google Gemini with configurable models
- **Autonomous agent workflow** — A LangGraph-based agent that plans, generates, edits, deploys, inspects, and verifies artifacts
- **Live injection** — React components, JavaScript, and CSS are injected directly into pages in real-time
- **URL pattern matching** — Artifacts auto-inject on matching pages using wildcard URL patterns
- **Element picker** — Visual CSS selector picker to target specific DOM elements
- **Background workers** — Persistent workers that run in Chrome's offscreen document
- **Version history** — Artifacts maintain version history with rollback support

## How It Works

1. **Open Conjure** — Click the extension icon to open the side panel
2. **Create an Extension** — Give it a name, URL pattern, and description
3. **Chat with the Agent** — Describe what you want. The agent inspects the page, generates artifacts, deploys them, and verifies
4. **Automatic re-injection** — When you navigate to a matching URL, all enabled artifacts are re-injected automatically

## Quick Example

> "Add a floating dark mode toggle to the bottom-right corner of this page"

The AI agent will:
1. Inspect the current page's DOM and styles
2. Generate a React component with a toggle button
3. Deploy it to the page
4. Verify the deployment worked

The component persists — every time you visit the same URL pattern, it reappears automatically.
