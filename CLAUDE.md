# Conjure

AI-powered Chrome extension that lets users create and inject React components, JS scripts, CSS styles, and background workers into any website using natural language. A LangGraph agent orchestrates planning, code generation, deployment, and verification. Data persists in IndexedDB with automatic re-injection on matching URLs.

## Tech Stack

- **Monorepo:** pnpm 10 + Turborepo
- **Language:** TypeScript (ES modules, `"type": "module"`)
- **Frontend:** React 19 + Tailwind CSS 3
- **Extension:** Manifest V3 (service worker, side panel, content scripts, offscreen document)
- **AI:** LangChain + LangGraph with OpenAI, Anthropic, Google providers
- **DB:** Dexie (IndexedDB wrapper) with singleton pattern
- **Build:** Vite 6
- **Test:** Vitest 4
- **Node:** >= 22.15.1

## Project Structure

| Package | Purpose |
|---------|---------|
| `packages/shared/` | Core: agent system, DB, types, AI providers |
| `packages/shared/lib/agent/tools/` | LangGraph agent tools (code generation, artifact management, DOM inspection) |
| `packages/shared/lib/db/` | Dexie schema, migrations |
| `chrome-extension/` | Manifest, background service worker |
| `pages/side-panel/` | Main React UI |
| `pages/content/` | Content script (injector, DOM tools, element picker) |
| `pages/offscreen/` | Background worker runtime |
| `packages/env/` | Environment variable management (`CEB_*` prefix) |

## Commands

```bash
pnpm dev              # Dev with HMR
pnpm build            # Production build to dist/
pnpm test             # Vitest
pnpm lint             # ESLint
pnpm lint:fix         # ESLint --fix
pnpm type-check       # TypeScript type checking
pnpm format           # Prettier
```

## Testing

- Vitest 4.x with `projects` config in root `vitest.config.ts`
- `fake-indexeddb/auto` polyfill for Dexie tests (loaded via setup files)
- Mocks live in `packages/shared/lib/__testing__/`
- In `afterEach`, clear tables with `.clear()` — never `.delete()` the DB (breaks Dexie singleton)
- When overriding mock functions in tool tests, always wrap with `vi.fn()` to allow spy assertions
- `@extension/shared` alias resolves to `packages/shared/index.mts`

## Git Conventions

- **Conventional Commits:** `<type>(<scope>): <description>` (feat, fix, docs, chore, refactor, test, etc.)
- **Branch naming:** `feat/`, `fix/`, `chore/`, `docs/`, `refactor/` prefixes
- **Pre-commit hook (Husky):** runs lint-staged, type-check, and test
- **Release:** semantic-release on `main` branch — auto-generates changelog, tags, and publishes to Chrome Web Store
- **Do NOT add `Co-Authored-By` lines to commit messages**

## Architecture Notes

- **Message routing:** Side Panel -> Background Service Worker -> Content Script / Offscreen
- **Agent tools** return JSON strings with `{ success, ... }` structure
- **Checkpointing:** Dexie-backed checkpoint storage enables resumable agent conversations
- **Sucrase:** Runtime JSX transpilation for generated components
- **URL pattern matching:** Wildcard patterns (e.g., `https://*.github.com/*`) for auto-injection