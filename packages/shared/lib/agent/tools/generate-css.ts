import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export function createGenerateCssTool(ctx: ToolContext) {
  return tool(
    async ({ name, description, cssRules }) => {
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'css',
        name,
        code: cssRules,
        enabled: true,
      });
      return JSON.stringify({
        success: true,
        artifactId: artifact.id,
        message: `CSS artifact "${name}" created successfully.${description ? ` Description: ${description}` : ''}`,
      });
    },
    {
      name: 'generate_css',
      description: 'Generate a new CSS stylesheet artifact. The CSS will be injected as a <style> tag in the page.',
      schema: z.object({
        name: z.string().describe('Stylesheet name (e.g. "DarkModeOverride")'),
        description: z.string().describe('Brief description of what the CSS does'),
        cssRules: z.string().describe('The CSS rules to inject'),
      }),
    },
  );
}
