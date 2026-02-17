---
sidebar_position: 2
---

# Getting Started

## Prerequisites

- **Node.js** >= 22.15.1 (see `.nvmrc`)
- **pnpm** 10.11.0 — Install with `npm install -g pnpm`
- **Chrome** (or Firefox for limited support)

## Installation

```bash
# Clone the repository
git clone https://github.com/nirberko/conjure.git
cd conjure

# Install dependencies
pnpm install
```

## Development

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

## Production Build

```bash
# Build for production
pnpm build

# Build and create distributable zip
pnpm zip
```

## Firefox Support

```bash
# Development
pnpm dev:firefox

# Production build
pnpm build:firefox
```

Load as a temporary add-on from `about:debugging#/runtime/this-firefox`.
