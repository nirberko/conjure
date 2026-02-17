import { resolvePackageVersion } from './add-dependency.js';
import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

const BUILTIN_SPECIFIERS = new Set(['react', 'react-dom', 'react-dom/client']);

const extractImportedPackages = (code: string): string[] => {
  const packages = new Set<string>();
  const importRegex = /import\s+[\s\S]+?\s+from\s+['"]([^'"./][^'"]*)['"]\s*;?/g;
  const sideEffectRegex = /import\s+['"]([^'"./][^'"]*)['"]\s*;?/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const specifier = match[1];
    const pkgName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (!BUILTIN_SPECIFIERS.has(specifier) && !BUILTIN_SPECIFIERS.has(pkgName)) {
      packages.add(pkgName);
    }
  }
  while ((match = sideEffectRegex.exec(code)) !== null) {
    const specifier = match[1];
    const pkgName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (!BUILTIN_SPECIFIERS.has(specifier) && !BUILTIN_SPECIFIERS.has(pkgName)) {
      packages.add(pkgName);
    }
  }
  return [...packages];
};

export const createGenerateReactTool = (ctx: ToolContext) =>
  tool(
    async ({ name, description, code, elementXPath, dependencies }) => {
      // Safety net: auto-resolve any imported packages missing from dependencies
      const importedPackages = extractImportedPackages(code);
      let resolvedDeps = dependencies ? { ...dependencies } : undefined;

      const failedResolutions: Array<{ package: string; error: string }> = [];

      if (importedPackages.length > 0) {
        const missing = importedPackages.filter(pkg => !resolvedDeps?.[pkg]);
        if (missing.length > 0) {
          resolvedDeps = resolvedDeps || {};
          const results = await Promise.all(missing.map(pkg => resolvePackageVersion(pkg)));
          for (let i = 0; i < missing.length; i++) {
            const result = results[i];
            if ('version' in result) {
              resolvedDeps[missing[i]] = result.version;
            } else {
              failedResolutions.push({ package: missing[i], error: result.error });
            }
          }
        }
      }

      const finalDeps = resolvedDeps && Object.keys(resolvedDeps).length > 0 ? resolvedDeps : undefined;
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'react-component',
        name,
        code,
        elementXPath: elementXPath || undefined,
        dependencies: finalDeps,
        enabled: true,
      });
      const depsInfo = finalDeps
        ? ` Dependencies: ${Object.entries(finalDeps)
            .map(([k, v]) => `${k}@${v}`)
            .join(', ')}`
        : '';
      const failedInfo =
        failedResolutions.length > 0
          ? ` Failed to resolve: ${failedResolutions.map(f => `${f.package} (${f.error})`).join(', ')}`
          : '';
      return JSON.stringify({
        success: true,
        artifactId: artifact.id,
        ...(failedResolutions.length > 0 && { failedResolutions }),
        message: `React component "${name}" created successfully.${description ? ` Description: ${description}` : ''}${depsInfo}${failedInfo}`,
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
            'Component code. If dependencies are provided, use `import` statements (React/ReactDOM are auto-imported). If no dependencies, write a function body ending with `return ComponentName;`. Inline styles only.',
          ),
        elementXPath: z
          .string()
          .optional()
          .describe(
            'Optional XPath expression for target element(s). If it matches multiple elements, the component is appended into each one. Omit for standalone components that mount to document.body.',
          ),
        dependencies: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            'Optional map of npm packages to pinned versions. Use add_dependency tool first to resolve versions, then pass them here. Example: {"recharts": "2.15.0", "date-fns": "4.1.0"}',
          ),
      }),
    },
  );
