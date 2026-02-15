# Contributing to Conjure

Thanks for your interest in contributing to Conjure! This guide will help you get started.

## Prerequisites

- **Node.js** 22+ (see `.nvmrc` for exact version)
- **pnpm** 10+ (`corepack enable` to use the bundled version)

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/conjure.git
   cd conjure
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start the development server:
   ```bash
   pnpm dev
   ```
5. Load the extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

## Project Structure

```
conjure/
├── chrome-extension/     # Extension manifest and background scripts
├── packages/
│   └── shared/           # Shared agent, DB, and types
│       └── lib/
│           ├── agent/    # LangGraph-based AI agent
│           │   └── tools/  # Agent tools
│           └── db/       # Dexie (IndexedDB) database
├── pages/
│   └── side-panel/       # Extension side panel UI
```

## Development Workflow

### Running Quality Checks

```bash
pnpm lint          # Run ESLint
pnpm type-check    # Run TypeScript type checking
pnpm test          # Run Vitest tests
```

### Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by semantic-release.

Format: `<type>(<scope>): <description>`

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Examples:**
- `feat(agent): add new browser automation tool`
- `fix(db): resolve race condition in data sync`
- `docs: update contributing guide`

### Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes and commit using conventional commits
3. Ensure all checks pass:
   ```bash
   pnpm lint && pnpm type-check && pnpm test
   ```
4. Push your branch and open a pull request against `main`
5. Use a conventional commit format for the PR title (e.g., `feat: add dark mode support`)
6. Fill out the PR template

## Coding Standards

- **ESLint** and **Prettier** are configured and enforced via `lint-staged` on commit
- Follow existing patterns in the codebase
- Write tests for new functionality
- Keep PRs focused — one feature or fix per PR
