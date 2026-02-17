import { getArtifact, updateArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const resolvePackageVersion = async (
  packageName: string,
  version?: string,
): Promise<{ version: string } | { error: string }> => {
  const url = version ? `https://esm.sh/${packageName}@${version}` : `https://esm.sh/${packageName}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { error: `Package "${packageName}" not found on esm.sh (status ${response.status})` };
    }

    const resolvedUrl = response.url;
    const escapedName = packageName.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
    const versionMatch = resolvedUrl.match(new RegExp(`${escapedName}@([\\d.]+[\\w.-]*)`));

    if (!versionMatch) {
      return version
        ? { version }
        : { error: `Could not determine pinned version for "${packageName}" from ${resolvedUrl}` };
    }

    return { version: versionMatch[1] };
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out'
        : err instanceof Error
          ? err.message
          : String(err);
    return { error: `Failed to resolve "${packageName}": ${message}` };
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createAddDependencyTool = (ctx: ToolContext) =>
  tool(
    async ({ artifactId, packageName, version }) => {
      const resolved = await resolvePackageVersion(packageName, version);

      if ('error' in resolved) {
        return JSON.stringify({ success: false, error: resolved.error });
      }

      // If artifactId is provided, update the artifact's dependencies
      if (artifactId) {
        const artifact = await getArtifact(artifactId);
        if (!artifact) {
          return JSON.stringify({ success: false, error: `Artifact "${artifactId}" not found` });
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
      }

      // No artifactId — just resolve and return the version
      return JSON.stringify({
        success: true,
        packageName,
        version: resolved.version,
        message: `Resolved ${packageName}@${resolved.version}. Pass { "${packageName}": "${resolved.version}" } in the dependencies parameter when calling generate_react_component.`,
      });
    },
    {
      name: 'add_dependency',
      description:
        'Resolve and pin an npm package version from esm.sh. Call this BEFORE generating or editing code that needs the package. When called without artifactId, returns the resolved version to pass in the `dependencies` parameter of `generate_react_component`. When called with artifactId, also updates that artifact\'s dependency list. After resolving, use standard `import { X } from "package"` syntax in your component code.',
      schema: z.object({
        artifactId: z
          .string()
          .optional()
          .describe(
            'Optional artifact ID to update. If omitted, just resolves and returns the pinned version without updating any artifact.',
          ),
        packageName: z.string().describe('npm package name (e.g. "recharts", "lodash-es", "date-fns")'),
        version: z
          .string()
          .optional()
          .describe('Specific version to pin. If omitted, resolves to the latest stable version.'),
      }),
    },
  );
