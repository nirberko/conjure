---
sidebar_position: 4
---

# Usage

## Setting Up

1. **Open the extension** — Click the Conjure icon; the side panel opens
2. **Configure AI** — In **Settings**, choose your provider (OpenAI, Anthropic, or Google), enter your API key, and select a model

## Supported AI Providers

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| **Anthropic** | claude-sonnet-4-20250514, claude-haiku-4-20250414 |
| **Google** | gemini-2.0-flash, gemini-2.5-pro, gemini-2.5-flash |

## Creating Extensions

1. Go to the **Extensions** tab
2. Click **New Extension**
3. Set a name, URL pattern (e.g. `https://*.github.com/*`), and optional description
4. Click **Create**

## Chatting with the Agent

Open an extension and use the **Chat** tab to describe what you want:

- *"Add a floating timer to the bottom-right corner"*
- *"Create a dark mode toggle for this page"*
- *"Add a word counter above the text editor"*
- *"Track price changes and show a history chart"*

The agent will inspect the page, generate artifacts, deploy them, and verify everything works.

## Managing Artifacts

In the **Artifacts** tab you can:

- **Deploy** or **remove** artifacts from the page
- **Start**, **stop**, or **reload** background workers
- View worker status (running/error)

## Artifact Types

| Type | Description |
|------|-------------|
| **React Component** | Full React components rendered in a shadow DOM mount point |
| **JavaScript** | IIFE scripts executed in the page's main world |
| **CSS** | Style rules injected as `<style>` elements |
| **Background Worker** | Persistent scripts running in Chrome's offscreen document |
