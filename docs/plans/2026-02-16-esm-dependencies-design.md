# ESM CDN Import Maps for Runtime npm Package Support

## Problem

Generated components run via `new Function('React', 'ReactDOM', 'context', code)` — no module system, no bundler at runtime, and `import`/`require` are explicitly forbidden. If a user asks for "a chart component", the agent must build everything from scratch with raw SVG/Canvas. We need a way to use npm packages like recharts, lodash-es, date-fns, etc.

## Decision

Use **ESM CDN Import Maps** (Approach 1). Chrome has supported import maps since v89. The agent writes standard `import` statements, esm.sh handles transitive dependencies and CJS→ESM conversion, and version pinning is embedded in the URL.

## Requirements

- **Both UI and utility libraries** (charts, date pickers, lodash, etc.)
- **Agent decides autonomously** which packages to use
- **CDN loading** from esm.sh at runtime (internet required)
- **Version pinning** — store exact version when component is created

## Architecture

```
Agent generates code with imports
        ↓
Dependencies stored on Artifact { dependencies: { "recharts": "2.15.0" } }
        ↓
Injector builds import map from all active artifacts' dependencies
        ↓
<script type="importmap"> injected into page
        ↓
Component code runs as <script type="module"> with native imports
```

## Data Model

New optional field on `Artifact`:

```typescript
export interface Artifact {
  // ... existing fields ...
  dependencies?: Record<string, string>;  // { "recharts": "2.15.0" }
}
```

No Dexie migration needed — non-indexed fields are schemaless.

## New Agent Tool: `add_dependency`

Resolves and pins an npm package for use in generated code.

```typescript
tool({
  name: 'add_dependency',
  description: 'Resolve and pin an npm package for use in generated code.',
  schema: z.object({
    artifactId: z.string(),
    packageName: z.string(),
    version: z.string().optional(),
  }),
})
```

**Resolution flow:**
1. HEAD request to `https://esm.sh/{packageName}` — follows redirect to pinned version URL
2. Extract resolved version from redirect
3. Store `{ [packageName]: resolvedVersion }` in artifact's `dependencies`

## Import Map Construction

```typescript
function buildImportMap(artifacts: Artifact[]): Record<string, string> {
  const imports: Record<string, string> = {
    "react": "https://esm.sh/react@19.1.0",
    "react-dom": "https://esm.sh/react-dom@19.1.0",
    "react-dom/client": "https://esm.sh/react-dom@19.1.0/client",
  };

  for (const artifact of artifacts) {
    if (!artifact.dependencies) continue;
    for (const [pkg, version] of Object.entries(artifact.dependencies)) {
      imports[pkg] = `https://esm.sh/${pkg}@${version}?external=react,react-dom`;
    }
  }

  return imports;
}
```

- `?external=react,react-dom` ensures all components share one React instance (critical for hooks)
- Import map injected once before any module script runs
- Version conflicts: first-loaded wins, log warning

## Component Execution Model

### Components WITH dependencies (new path)

```javascript
// 1. Expose context on namespaced global
window.__CONJURE_CTX__[componentId] = context;

// 2. Build module code
const moduleCode = `
import React from 'react';
import ReactDOM from 'react-dom/client';
${importStatements}

const context = window.__CONJURE_CTX__['${componentId}'];
${userCode}

const mountEl = document.getElementById('${mountId}');
if (mountEl) {
  const root = ReactDOM.createRoot(mountEl);
  root.render(React.createElement(${componentName}, { context }));
}
`;

// 3. Execute as module via Blob URL
const blob = new Blob([moduleCode], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const script = document.createElement('script');
script.type = 'module';
script.src = url;
document.head.appendChild(script);
```

### Components WITHOUT dependencies (unchanged)

Existing `new Function()` path remains — zero regression risk.

## Agent Prompt Changes

New rules:
- Call `add_dependency` before generating code that needs npm packages
- Use standard `import` syntax after adding dependencies
- Prefer ESM variants (e.g. `lodash-es` over `lodash`)
- Don't import React/ReactDOM — provided automatically
- `context` is still a parameter, not imported

## Background Workers

No changes. Workers run in sandboxed iframe (no import maps). Workers can use dynamic `import()` from esm.sh URLs directly:

```javascript
const { default: _ } = await import('https://esm.sh/lodash-es@4.17.21');
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| esm.sh down | Tool returns error, agent falls back to no-library code |
| Package not found | HEAD returns 404, clear error to agent |
| CSP blocks Blob URLs | Fall back to inline `<script type="module">` |
| CSP blocks esm.sh | Pre-validate fetch, return error to agent |
| Import map timing | Collect all deps first, inject map once, then inject scripts |

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/lib/types/index.ts` | Add `dependencies?` to `Artifact` |
| `packages/shared/lib/agent/tools/add-dependency.ts` | **New** — dependency resolution tool |
| `packages/shared/lib/agent/tools/index.ts` | Register new tool |
| `packages/shared/lib/agent/tools/generate-react.ts` | Pass through dependencies |
| `packages/shared/lib/agent/prompts.ts` | New rules for import usage |
| `pages/content/src/import-map.ts` | **New** — import map builder |
| `pages/content/src/injector.ts` | Module execution path for components with deps |
| `chrome-extension/src/background/index.ts` | Skip Sucrase for module-path components |
| `pages/content/src/react-runtime.ts` | Potentially simplified |
