import { resolvePackageVersion } from './add-dependency.js';
import { getArtifact, updateArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

const BUILTIN_SPECIFIERS = new Set(['react', 'react-dom', 'react-dom/client']);

const extractImportedPackages = (code: string): string[] => {
  const packages = new Set<string>();
  const importRegex = /^\s*import\s+.+?\s+from\s+['"]([^'"./][^'"]*)['"]\s*;?\s*$/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const specifier = match[1];
    const pkgName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (!BUILTIN_SPECIFIERS.has(specifier) && !BUILTIN_SPECIFIERS.has(pkgName)) {
      packages.add(pkgName);
    }
  }
  return [...packages];
};

export const createEditArtifactTool = (ctx: ToolContext) =>
  tool(
    async ({ artifactId, newCode, instruction, elementXPath }) => {
      const artifact = await getArtifact(artifactId);
      if (!artifact) {
        return JSON.stringify({ success: false, error: `Artifact "${artifactId}" not found` });
      }

      const updates: Record<string, unknown> = { code: newCode };
      if (elementXPath !== undefined) {
        updates.elementXPath = elementXPath || undefined;
      }

      // Safety net: auto-resolve any imported packages missing from dependencies
      if (artifact.type === 'react-component') {
        const importedPackages = extractImportedPackages(newCode);
        if (importedPackages.length > 0) {
          const existingDeps = (artifact.dependencies as Record<string, string> | undefined) ?? {};
          const missing = importedPackages.filter(pkg => !existingDeps[pkg]);
          if (missing.length > 0) {
            const resolvedDeps = { ...existingDeps };
            const results = await Promise.all(missing.map(pkg => resolvePackageVersion(pkg)));
            for (let i = 0; i < missing.length; i++) {
              const result = results[i];
              if ('version' in result) {
                resolvedDeps[missing[i]] = result.version;
              }
            }
            updates.dependencies = resolvedDeps;
          }
        }
      }

      await updateArtifact(artifactId, updates);

      // Hot-reload background workers after code update
      if (artifact.type === 'background-worker') {
        try {
          await ctx.sendToServiceWorker({
            type: 'RELOAD_BACKGROUND_WORKER',
            payload: { artifactId },
          });
        } catch {
          // Worker may not be running — that's fine
        }
      }

      return JSON.stringify({
        success: true,
        artifactId,
        message: `Artifact "${artifact.name}" updated. Instruction: ${instruction}`,
      });
    },
    {
      name: 'edit_artifact',
      description:
        'Modify an existing artifact. Updates code and can also change elementXPath to reposition where a React component is mounted. When the user asks to move, reposition, or change where a component appears, update elementXPath. Pass empty string to clear it (mount to body). For React components: code MUST end with `return ComponentName;`, use inline styles only, no imports. For workers: use only conjure API.',
      schema: z.object({
        artifactId: z.string().describe('The ID of the artifact to edit'),
        newCode: z
          .string()
          .describe(
            'The complete updated code. Same format rules as generate tools apply — React components must end with return, workers use conjure API only.',
          ),
        instruction: z.string().describe('Description of what was changed and why'),
        elementXPath: z
          .string()
          .optional()
          .describe(
            'Optional: update the XPath expression for where the component is mounted. Pass a new XPath to change target elements, or empty string to clear it (mount to body). Omit to leave unchanged.',
          ),
      }),
    },
  );
