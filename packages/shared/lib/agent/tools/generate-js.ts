import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createGenerateJsTool = (ctx: ToolContext) =>
  tool(
    async ({ name, description, code }) => {
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'js-script',
        name,
        code,
        enabled: true,
      });
      return JSON.stringify({
        success: true,
        artifactId: artifact.id,
        message: `JS script "${name}" created successfully.${description ? ` Description: ${description}` : ''}`,
      });
    },
    {
      name: 'generate_js_script',
      description:
        'Generate a new plain JavaScript script artifact. The script executes in the page MAIN world, wrapped in an IIFE. No React runtime needed.',
      schema: z.object({
        name: z.string().describe('Script name (e.g. "AutoScroller")'),
        description: z.string().describe('Brief description of what the script does'),
        code: z.string().describe('The JavaScript code to execute'),
      }),
    },
  );
