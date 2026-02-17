import { getArtifact, updateArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

const resolvePackageVersion = async (
  packageName: string,
  version?: string,
): Promise<{ version: string } | { error: string }> => {
  const url = version ? `https://esm.sh/${packageName}@${version}` : `https://esm.sh/${packageName}`;

  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });

    if (!response.ok) {
      return { error: `Package "${packageName}" not found on esm.sh (status ${response.status})` };
    }

    const resolvedUrl = response.url;
    const versionMatch = resolvedUrl.match(new RegExp(`${packageName.replace('/', '\\/')}@([\\d.]+[\\w.-]*)`));

    if (!versionMatch) {
      return { version: version ?? 'latest' };
    }

    return { version: versionMatch[1] };
  } catch (err) {
    return { error: `Failed to resolve "${packageName}": ${err instanceof Error ? err.message : String(err)}` };
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
