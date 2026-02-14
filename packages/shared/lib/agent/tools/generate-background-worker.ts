import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export function createGenerateBackgroundWorkerTool(ctx: ToolContext) {
  return tool(
    async ({ name, description, code }) => {
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'background-worker',
        name,
        code,
        enabled: true,
      });
      return JSON.stringify({
        success: true,
        artifactId: artifact.id,
        message: `Background worker "${name}" created successfully.${description ? ` Description: ${description}` : ''} Use deploy_artifact to start it.`,
      });
    },
    {
      name: 'generate_background_worker',
      description:
        'Generate a new background worker artifact. Background workers run headlessly in the browser, reacting to triggers (URL navigation, messages, storage changes) and communicating with content scripts. The code receives a `webforge` API object.',
      schema: z.object({
        name: z.string().describe('Worker name (e.g. "PageTracker", "AutoNotifier")'),
        description: z.string().describe('Brief description of what the worker does'),
        code: z
          .string()
          .describe(
            'The JavaScript code for the worker. It receives a `webforge` object with: webforge.on(event, handler), webforge.storage, webforge.tabs, webforge.messaging, webforge.log(), webforge.error()',
          ),
      }),
    },
  );
}
