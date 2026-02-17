# ESM CDN Dependencies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable generated React components to use npm packages loaded from esm.sh via native browser import maps.

**Architecture:** Agent declares dependencies via a new `add_dependency` tool, which resolves package versions from esm.sh. At injection time, an import map is built from all active artifacts' dependencies and injected into the page. Components with dependencies execute as `<script type="module">` instead of `new Function()`.

**Tech Stack:** esm.sh CDN, browser import maps, ES modules, existing Sucrase transpilation pipeline

---

### Task 1: Add `dependencies` field to `Artifact` type

**Files:**
- Modify: `packages/shared/lib/types/index.ts:90-101`

**Step 1: Add the field**

In `packages/shared/lib/types/index.ts`, add `dependencies?` to the `Artifact` interface:

```typescript
export interface Artifact {
  id: string;
  extensionId: string;
  type: ArtifactType;
  name: string;
  code: string;
  codeVersions: { code: string; timestamp: number }[];
  elementXPath?: string;
  dependencies?: Record<string, string>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
```

**Step 2: Verify types compile**

Run: `pnpm type-check`
Expected: All packages pass type-check (no Dexie migration needed — non-indexed field).

**Step 3: Commit**

```bash
git add packages/shared/lib/types/index.ts
git commit -m "feat(types): add dependencies field to Artifact interface"
```

---

### Task 2: Create `add-dependency` agent tool

**Files:**
- Create: `packages/shared/lib/agent/tools/add-dependency.ts`
- Create: `packages/shared/lib/agent/tools/__tests__/add-dependency.test.ts`
- Modify: `packages/shared/lib/agent/tools/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/lib/agent/tools/__tests__/add-dependency.test.ts`:

```typescript
import { createAddDependencyTool } from '../add-dependency.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../types.js';

const createMockToolContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  extensionId: 'test-ext',
  tabId: 123,
  sendToContentScript: vi.fn().mockResolvedValue({}),
  waitForMessage: vi.fn().mockResolvedValue({}),
  sendToServiceWorker: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe('add_dependency tool', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
    vi.restoreAllMocks();
  });

  it('resolves a package version from esm.sh and stores it', async () => {
    // Mock fetch to simulate esm.sh redirect
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://esm.sh/recharts@2.15.0',
      status: 200,
    });

    ctx.sendToServiceWorker = vi.fn().mockResolvedValue({
      success: true,
      artifact: {
        id: 'art-1',
        dependencies: {},
      },
    });

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'recharts' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.packageName).toBe('recharts');
    expect(parsed.version).toBe('2.15.0');
  });

  it('uses explicit version when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://esm.sh/recharts@2.12.0',
      status: 200,
    });

    ctx.sendToServiceWorker = vi.fn().mockResolvedValue({
      success: true,
      artifact: { id: 'art-1', dependencies: {} },
    });

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'recharts', version: '2.12.0' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.version).toBe('2.12.0');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://esm.sh/recharts@2.12.0',
      expect.objectContaining({ method: 'HEAD', redirect: 'follow' }),
    );
  });

  it('returns error when package not found on esm.sh', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      url: 'https://esm.sh/nonexistent-package-xyz',
    });

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'nonexistent-package-xyz' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('not found');
  });

  it('returns error when fetch fails (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'recharts' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Network error');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — module `../add-dependency.js` not found.

**Step 3: Write the tool implementation**

Create `packages/shared/lib/agent/tools/add-dependency.ts`:

```typescript
import { getArtifact, updateArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

const resolvePackageVersion = async (packageName: string, version?: string): Promise<{ version: string } | { error: string }> => {
  const url = version
    ? `https://esm.sh/${packageName}@${version}`
    : `https://esm.sh/${packageName}`;

  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });

    if (!response.ok) {
      return { error: `Package "${packageName}" not found on esm.sh (status ${response.status})` };
    }

    // esm.sh redirects to the versioned URL, e.g. https://esm.sh/recharts@2.15.0/...
    const resolvedUrl = response.url;
    const versionMatch = resolvedUrl.match(new RegExp(`${packageName.replace('/', '\\/')}@([\\d.]+[\\w.-]*)`));

    if (!versionMatch) {
      // Fallback: use provided version or 'latest'
      return { version: version ?? 'latest' };
    }

    return { version: versionMatch[1] };
  } catch (err) {
    return { error: `Failed to resolve "${packageName}": ${err instanceof Error ? err.message : String(err)}` };
  }
};

export const createAddDependencyTool = (ctx: ToolContext) =>
  tool(
    async ({ artifactId, packageName, version }) => {
      const artifact = await getArtifact(artifactId);
      if (!artifact) {
        return JSON.stringify({ success: false, error: `Artifact "${artifactId}" not found` });
      }

      const resolved = await resolvePackageVersion(packageName, version);

      if ('error' in resolved) {
        return JSON.stringify({ success: false, error: resolved.error });
      }

      const dependencies = { ...(artifact.dependencies ?? {}), [packageName]: resolved.version };
      await updateArtifact(artifactId, { dependencies });

      return JSON.stringify({
        success: true,
        artifactId,
        packageName,
        version: resolved.version,
        message: `Added ${packageName}@${resolved.version}. You can now use \`import\` statements for this package in your component code.`,
      });
    },
    {
      name: 'add_dependency',
      description:
        'Resolve and pin an npm package from esm.sh for use in generated React component code. Call this BEFORE generating or editing code that needs the package. After adding a dependency, use standard `import { X } from "package"` syntax in your component code.',
      schema: z.object({
        artifactId: z.string().describe('The artifact that will use this dependency'),
        packageName: z.string().describe('npm package name (e.g. "recharts", "lodash-es", "date-fns")'),
        version: z
          .string()
          .optional()
          .describe('Specific version to pin. If omitted, resolves to the latest stable version.'),
      }),
    },
  );
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: Tests pass. Note: the test mocks `global.fetch` and `ctx.sendToServiceWorker`, and the tool calls `getArtifact`/`updateArtifact` from Dexie — the tests using real DB calls will need `fake-indexeddb/auto`. If tests fail because of Dexie, add a setup import at the top of the test file: `import 'fake-indexeddb/auto';` and mock `getArtifact`/`updateArtifact` from `../../db/index.js` instead.

If Dexie mocking is needed, update the test to mock the DB:

```typescript
vi.mock('../../db/index.js', () => ({
  getArtifact: vi.fn(),
  updateArtifact: vi.fn(),
}));
import { getArtifact, updateArtifact } from '../../db/index.js';
```

And in each test, set up the mock returns:

```typescript
(getArtifact as ReturnType<typeof vi.fn>).mockResolvedValue({
  id: 'art-1',
  extensionId: 'test-ext',
  type: 'react-component',
  dependencies: {},
});
(updateArtifact as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
```

**Step 5: Register the tool in index.ts**

In `packages/shared/lib/agent/tools/index.ts`, add:

```typescript
import { createAddDependencyTool } from './add-dependency.js';
```

Add to the `createAgentTools` array:

```typescript
createAddDependencyTool(ctx),
```

Add to the named exports:

```typescript
export { createAddDependencyTool, ... };
```

**Step 6: Run type-check and tests**

Run: `pnpm type-check && pnpm test`
Expected: All pass.

**Step 7: Commit**

```bash
git add packages/shared/lib/agent/tools/add-dependency.ts packages/shared/lib/agent/tools/__tests__/add-dependency.test.ts packages/shared/lib/agent/tools/index.ts
git commit -m "feat(agent): add add_dependency tool for resolving npm packages from esm.sh"
```

---

### Task 3: Create import map builder module

**Files:**
- Create: `pages/content/src/import-map.ts`

**Step 1: Write the import map builder**

Create `pages/content/src/import-map.ts`:

```typescript
import type { Artifact } from '@extension/shared';

const REACT_VERSION = '19.1.0';

export const buildImportMap = (artifacts: Artifact[]): Record<string, string> => {
  const imports: Record<string, string> = {
    'react': `https://esm.sh/react@${REACT_VERSION}`,
    'react/': `https://esm.sh/react@${REACT_VERSION}/`,
    'react-dom': `https://esm.sh/react-dom@${REACT_VERSION}?external=react`,
    'react-dom/': `https://esm.sh/react-dom@${REACT_VERSION}&external=react/`,
  };

  for (const artifact of artifacts) {
    if (!artifact.dependencies) continue;
    for (const [pkg, version] of Object.entries(artifact.dependencies)) {
      if (imports[pkg]) continue; // first-loaded wins
      imports[pkg] = `https://esm.sh/${pkg}@${version}?external=react,react-dom`;
    }
  }

  return imports;
};

let importMapInjected = false;

export const injectImportMap = (artifacts: Artifact[]): void => {
  if (importMapInjected) return; // import maps can only be set once per document

  const imports = buildImportMap(artifacts);
  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = JSON.stringify({ imports });

  // Import map must be injected before any module scripts
  const firstScript = document.querySelector('script');
  if (firstScript) {
    firstScript.before(script);
  } else {
    (document.head || document.documentElement).appendChild(script);
  }

  importMapInjected = true;
};

export const hasImportMap = (): boolean => importMapInjected;

export const resetImportMapState = (): void => {
  importMapInjected = false;
};
```

**Step 2: Run type-check**

Run: `pnpm type-check`
Expected: PASS.

**Step 3: Commit**

```bash
git add pages/content/src/import-map.ts
git commit -m "feat(content): add import map builder for ESM CDN dependencies"
```

---

### Task 4: Add module execution path to background service worker

**Files:**
- Modify: `chrome-extension/src/background/index.ts:113-390`

This task adds a new message type `EXECUTE_MODULE_IN_PAGE` that injects component code as a `<script type="module">` instead of `new Function()`.

**Step 1: Add the new message handler**

In `chrome-extension/src/background/index.ts`, add a new case after the existing `EXECUTE_IN_PAGE` case (around line 390):

```typescript
case 'EXECUTE_MODULE_IN_PAGE': {
  const tabId = sender.tab?.id;
  const {
    code,
    mountId,
    componentId,
    extensionId: extId,
    dependencies,
  } = message.payload as {
    code: string;
    mountId: string;
    componentId: string;
    extensionId?: string;
    dependencies: Record<string, string>;
  };

  if (tabId) {
    const tab = await chrome.tabs.get(tabId);
    const pageUrl = tab.url || '';

    let transformedCode = code;
    try {
      transformedCode = transform(code, { transforms: ['jsx'] }).code;
    } catch {
      // Code may already be plain JS
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (
        componentCode: string,
        mId: string,
        cId: string,
        pUrl: string,
        eId: string,
        deps: Record<string, string>,
      ) => {
        // Build import statements from dependencies
        // Dependencies are already in the import map, so bare specifiers work
        const importLines = Object.keys(deps)
          .filter(pkg => !['react', 'react-dom'].includes(pkg))
          .map(() => '') // imports are in the user code itself
          .join('');

        // Context setup — expose on global for module to pick up
        const ctxGlobal = ((window as unknown as Record<string, unknown>).__CONJURE_CTX__ ??= {}) as Record<
          string,
          unknown
        >;

        let _nextReqId = 0;
        const extDbCall = (action: string, payload: Record<string, unknown>): Promise<unknown> =>
          new Promise((resolve, reject) => {
            const reqId = 'db' + ++_nextReqId + '_' + Date.now();
            const handler = (e: Event) => {
              window.removeEventListener('conjure-ext-db-' + reqId, handler);
              const d = (e as CustomEvent).detail;
              if (d.error) reject(new Error(d.error));
              else resolve(d.result);
            };
            window.addEventListener('conjure-ext-db-' + reqId, handler);
            window.dispatchEvent(
              new CustomEvent('conjure-ext-db', {
                detail: { extensionId: eId, action, payload, requestId: reqId },
              }),
            );
          });

        const getData = (): Promise<Record<string, unknown>> =>
          extDbCall('storageGet', { key: cId + ':' + pUrl }) as Promise<Record<string, unknown>>;
        const setData = (data: Record<string, unknown>): Promise<void> =>
          extDbCall('storageSet', { key: cId + ':' + pUrl, data }) as Promise<void>;
        const sendMessage = (data: unknown): void => {
          window.dispatchEvent(
            new CustomEvent('conjure-send-worker-message', { detail: { extensionId: eId, data } }),
          );
        };
        const onWorkerMessage = (callback: (data: unknown) => void): (() => void) => {
          const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.extensionId !== eId) return;
            callback(detail.data);
          };
          window.addEventListener('conjure-worker-message', handler);
          return () => window.removeEventListener('conjure-worker-message', handler);
        };
        const db = {
          createTables: (tables: Record<string, string>) => extDbCall('createTables', { tables }),
          removeTables: (tableNames: string[]) => extDbCall('removeTables', { tableNames }),
          getSchema: () => extDbCall('getSchema', {}),
          put: (table: string, data: Record<string, unknown>) =>
            extDbCall('query', { operation: { type: 'put', table, data } }),
          add: (table: string, data: Record<string, unknown>) =>
            extDbCall('query', { operation: { type: 'add', table, data } }),
          get: (table: string, key: string | number) =>
            extDbCall('query', { operation: { type: 'get', table, key } }),
          getAll: (table: string) => extDbCall('query', { operation: { type: 'getAll', table } }),
          update: (table: string, key: string | number, changes: Record<string, unknown>) =>
            extDbCall('query', { operation: { type: 'update', table, key, changes } }),
          delete: (table: string, key: string | number) =>
            extDbCall('query', { operation: { type: 'delete', table, key } }),
          where: (table: string, index: string, value: unknown, limit?: number) =>
            extDbCall('query', { operation: { type: 'where', table, index, value, limit } }),
          bulkPut: (table: string, data: Record<string, unknown>[]) =>
            extDbCall('query', { operation: { type: 'bulkPut', table, data } }),
          bulkDelete: (table: string, keys: (string | number)[]) =>
            extDbCall('query', { operation: { type: 'bulkDelete', table, keys } }),
          count: (table: string) => extDbCall('query', { operation: { type: 'count', table } }),
          clear: (table: string) => extDbCall('query', { operation: { type: 'clear', table } }),
        };
        const env = {
          async get(key: string): Promise<string | null> {
            const envData = ((await extDbCall('storageGet', { key: '_env' })) ?? {}) as Record<string, string>;
            return envData[key] ?? null;
          },
          async getAll(): Promise<Record<string, string>> {
            return ((await extDbCall('storageGet', { key: '_env' })) ?? {}) as Record<string, string>;
          },
        };

        ctxGlobal[cId + '_' + mId] = { getData, setData, pageUrl: pUrl, sendMessage, onWorkerMessage, db, env };

        // Extract component name from code (look for function ComponentName or return ComponentName)
        const nameMatch = componentCode.match(/return\s+([A-Z]\w*)\s*;?\s*$/) ||
          componentCode.match(/function\s+([A-Z]\w*)\s*\(/);
        const componentName = nameMatch ? nameMatch[1] : '_Component';

        // Build module code
        const moduleCode = [
          `import React from 'react';`,
          `import ReactDOM from 'react-dom/client';`,
          '',
          `const context = window.__CONJURE_CTX__['${cId}_${mId}'];`,
          '',
          // Wrap user code in a function to extract the component
          `const _getComponent = (function() {`,
          componentCode,
          `})();`,
          '',
          `const _Component = _getComponent || ${componentName};`,
          `const mountEl = document.getElementById('${mId}');`,
          `if (mountEl && _Component) {`,
          `  const root = ReactDOM.createRoot(mountEl);`,
          `  root.render(React.createElement(_Component, { context }));`,
          `} else if (mountEl) {`,
          `  mountEl.innerHTML = '<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: Component did not return a valid component.</div>';`,
          `}`,
        ].join('\n');

        // Execute as module via Blob URL
        const blob = new Blob([moduleCode], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const script = document.createElement('script');
        script.type = 'module';
        script.src = blobUrl;
        script.onerror = () => {
          const mountEl = document.getElementById(mId);
          if (mountEl) {
            mountEl.innerHTML =
              '<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: Module failed to load. Check console for errors.</div>';
          }
          URL.revokeObjectURL(blobUrl);
        };
        script.onload = () => URL.revokeObjectURL(blobUrl);
        document.head.appendChild(script);
      },
      args: [transformedCode, mountId, componentId, pageUrl, extId ?? '', dependencies ?? {}],
    });
  }
  return { success: true };
}
```

**Step 2: Run type-check**

Run: `pnpm type-check`
Expected: PASS.

**Step 3: Commit**

```bash
git add chrome-extension/src/background/index.ts
git commit -m "feat(background): add EXECUTE_MODULE_IN_PAGE handler for ESM module execution"
```

---

### Task 5: Update injector to use module path for components with dependencies

**Files:**
- Modify: `pages/content/src/injector.ts`

**Step 1: Update the injector**

In `pages/content/src/injector.ts`, add the import map module and modify the React injection path:

Add import at top:

```typescript
import { injectImportMap, hasImportMap } from './import-map.js';
```

Modify `injectReactArtifact` to check for dependencies and use the module path:

Replace the component execution loop (lines 143-150) with:

```typescript
    const hasDeps = artifact.dependencies && Object.keys(artifact.dependencies).length > 0;

    // Execute component code for each mount point
    for (let i = 0; i < hosts.length; i++) {
      const mountId = `conjure-mount-${artifact.id}-${i}`;

      if (hasDeps) {
        // Module path: use import map + <script type="module">
        await chrome.runtime.sendMessage({
          type: 'EXECUTE_MODULE_IN_PAGE',
          payload: {
            code: artifact.code,
            mountId,
            componentId: artifact.id,
            extensionId: artifact.extensionId,
            dependencies: artifact.dependencies,
          },
        });
      } else {
        // Legacy path: use new Function() (no dependencies)
        await chrome.runtime.sendMessage({
          type: 'EXECUTE_IN_PAGE',
          payload: { code: artifact.code, mountId, componentId: artifact.id, extensionId: artifact.extensionId },
        });
      }
    }
```

Also update `injectReactArtifact` to inject the import map before components. Add this right after the `await injectReactRuntime();` line:

```typescript
    // If any artifact has dependencies, inject import map (must happen before module scripts)
    if (artifact.dependencies && Object.keys(artifact.dependencies).length > 0 && !hasImportMap()) {
      // Collect dependencies from all artifacts that need them on this page
      // For now, inject with just this artifact's deps — future: batch all
      injectImportMap([artifact]);
    }
```

**Step 2: Run type-check**

Run: `pnpm type-check`
Expected: PASS.

**Step 3: Commit**

```bash
git add pages/content/src/injector.ts
git commit -m "feat(injector): route components with dependencies through module execution path"
```

---

### Task 6: Update `generate-react` tool to accept dependencies

**Files:**
- Modify: `packages/shared/lib/agent/tools/generate-react.ts`

**Step 1: Update the tool to pass through dependencies**

The `generate_react_component` tool should accept an optional `dependencies` parameter so the agent can declare them inline (as an alternative to calling `add_dependency` separately).

```typescript
import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createGenerateReactTool = (ctx: ToolContext) =>
  tool(
    async ({ name, description, code, elementXPath, dependencies }) => {
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'react-component',
        name,
        code,
        elementXPath: elementXPath || undefined,
        dependencies: dependencies || undefined,
        enabled: true,
      });
      return JSON.stringify({
        success: true,
        artifactId: artifact.id,
        message: `React component "${name}" created successfully.${description ? ` Description: ${description}` : ''}${dependencies ? ` Dependencies: ${Object.entries(dependencies).map(([k, v]) => `${k}@${v}`).join(', ')}` : ''}`,
      });
    },
    {
      name: 'generate_react_component',
      description:
        'Generate a new React component artifact. When elementXPath is provided, the component is appended into every matching element (supports multiple). When omitted, mounts to document.body. When dependencies are provided, the component runs as an ES module with import map support — use standard `import` syntax. Without dependencies, code is a function body with params (React, ReactDOM, context) and MUST end with `return ComponentName;`. Use React.useState (not destructured). Use ONLY inline styles. context provides: getData(), setData(), pageUrl, sendMessage(), onWorkerMessage(), and db.* methods.',
      schema: z.object({
        name: z.string().describe('Component name (e.g. "NotesWidget")'),
        description: z.string().describe('Brief description of what the component does'),
        code: z
          .string()
          .describe(
            'Component code. If dependencies are provided, use `import` statements for them (React/ReactDOM are auto-imported). If no dependencies, write a function body ending with `return ComponentName;`. Inline styles only.',
          ),
        elementXPath: z
          .string()
          .optional()
          .describe(
            'Optional XPath expression for target element(s). Omit for standalone components that mount to document.body.',
          ),
        dependencies: z
          .record(z.string())
          .optional()
          .describe(
            'Optional map of npm packages to pinned versions. Use add_dependency tool first to resolve versions, then pass them here. Example: {"recharts": "2.15.0", "date-fns": "4.1.0"}',
          ),
      }),
    },
  );
```

**Step 2: Run type-check and tests**

Run: `pnpm type-check && pnpm test`
Expected: PASS.

**Step 3: Commit**

```bash
git add packages/shared/lib/agent/tools/generate-react.ts
git commit -m "feat(agent): accept dependencies parameter in generate_react_component tool"
```

---

### Task 7: Update agent system prompt

**Files:**
- Modify: `packages/shared/lib/agent/prompts.ts`

**Step 1: Update the prompt**

Make these changes to `packages/shared/lib/agent/prompts.ts`:

1. In the **Tool Selection Decision Tree** section (around line 83-99), add a new row:

```
| NEED an npm package for a component | \`add_dependency\` — resolves and pins version from esm.sh |
```

2. In the **Code Format Rules > React Components** section (around lines 126-145), add after the existing rules:

```
### React Components with Dependencies
When a component needs npm packages (charts, date formatting, markdown, etc.):
1. Call \`add_dependency\` for each package to resolve and pin the version
2. Pass the resolved \`dependencies\` map to \`generate_react_component\`
3. Use standard \`import\` syntax in your code — React and ReactDOM are auto-imported
4. Prefer ESM variants: \`lodash-es\` over \`lodash\`, \`date-fns\` over \`moment\`
5. The \`context\` object is still available — it's provided as a global, not imported
6. MUST still end with \`return ComponentName;\`

\`\`\`
// With dependencies: {"recharts": "2.15.0"}
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

function SalesChart({ context }) {
  const [data, setData] = React.useState([]);

  React.useEffect(() => {
    context.db.createTables({ sales: '++id, month, amount' });
    context.db.getAll('sales').then(setData);
  }, []);

  return <div style={{ padding: '16px' }}>
    <LineChart width={400} height={300} data={data}>
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="amount" stroke="#3b82f6" />
    </LineChart>
  </div>;
}
return SalesChart;
\`\`\`
```

3. In the **Common Mistakes** section, update mistake #2:

```
**2. Using import/require without dependencies**
WRONG: \`import Chart from 'chart.js';\` (no dependencies declared)
RIGHT: First call \`add_dependency\` to resolve the package, then pass \`dependencies\` to \`generate_react_component\`, then use \`import\` in code.
For components WITHOUT dependencies: React is already available — just use \`React.useState\`, etc.
```

4. In **CRITICAL RULES**, update rule 5:

```
5. NEVER use \`import\` or \`require\` in artifact code WITHOUT first resolving dependencies via \`add_dependency\`. Components without dependencies must use React/ReactDOM from parameters. Components WITH dependencies can use \`import\` syntax.
```

5. In the **CSP Compliance** table, update the import row:

```
| \`import\` / \`require\` (without dependencies) | Use provided APIs (React, context, conjure). For npm packages, use \`add_dependency\` first. |
```

**Step 2: Run type-check**

Run: `pnpm type-check`
Expected: PASS.

**Step 3: Commit**

```bash
git add packages/shared/lib/agent/prompts.ts
git commit -m "feat(agent): update system prompt with dependency and import map usage rules"
```

---

### Task 8: Batch import map injection for page-load artifacts

**Files:**
- Modify: `pages/content/src/injector.ts`

Currently the injector handles one artifact at a time, but import maps must be set before any module script runs, and can only be set once. We need a batch entry point.

**Step 1: Add a batch injection function**

Add to `pages/content/src/injector.ts`:

```typescript
const injectArtifactsBatch = async (artifacts: Artifact[]): Promise<void> => {
  // Separate artifacts that need import maps from those that don't
  const withDeps = artifacts.filter(a => a.type === 'react-component' && a.dependencies && Object.keys(a.dependencies).length > 0);

  // If any artifacts have dependencies, inject the import map FIRST (before any module scripts)
  if (withDeps.length > 0 && !hasImportMap()) {
    injectImportMap(artifacts);
  }

  // Then inject all artifacts in order
  for (const artifact of artifacts) {
    await injectArtifact(artifact);
  }
};

export { injectArtifact, injectArtifactsBatch, removeArtifact, isArtifactInjected };
```

**Step 2: Run type-check**

Run: `pnpm type-check`
Expected: PASS.

**Step 3: Commit**

```bash
git add pages/content/src/injector.ts
git commit -m "feat(injector): add batch injection with pre-flight import map setup"
```

---

### Task 9: Update content script loader to use batch injection

**Files:**
- Find and modify the content script entry point that loads matching artifacts on page navigation

**Step 1: Find the loader**

Look for the content script entry that calls `injectArtifact` for page-load artifacts. This is likely in `pages/content/src/index.ts` or similar. It receives the `LOAD_EXTENSIONS` response and injects each artifact.

Update it to use `injectArtifactsBatch` instead of calling `injectArtifact` in a loop.

**Step 2: Run type-check and test**

Run: `pnpm type-check && pnpm test`
Expected: PASS.

**Step 3: Commit**

```bash
git add pages/content/src/
git commit -m "feat(content): use batch injection on page load for import map ordering"
```

---

### Task 10: Manual integration testing

**No code changes.** This is a manual verification checklist.

**Step 1: Build the extension**

Run: `pnpm build`
Expected: Build succeeds with no errors.

**Step 2: Load in Chrome**

Load the `dist/` folder as an unpacked extension in Chrome.

**Step 3: Test without dependencies (regression)**

Ask the agent to create a simple counter component (no npm packages). Verify it works exactly as before — same `new Function()` path.

**Step 4: Test with dependencies**

Ask the agent: "Create a line chart showing sample data using recharts"

Expected flow:
1. Agent calls `think`
2. Agent calls `add_dependency` with `recharts`
3. Agent calls `generate_react_component` with `dependencies: { "recharts": "2.15.0" }` and code using `import`
4. Agent calls `deploy_artifact`
5. Import map injected into page
6. Component renders with recharts chart

**Step 5: Verify in DevTools**

- Check the page source for `<script type="importmap">` — should contain react and recharts entries
- Check for `<script type="module">` blob URL — should execute the component
- No console errors about missing modules
