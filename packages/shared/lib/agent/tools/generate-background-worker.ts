import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createGenerateBackgroundWorkerTool = (ctx: ToolContext) =>
  tool(
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
        'Generate a new background worker artifact. Code receives a `conjure` object. Register handlers with conjure.on(event, handler). Events: url_navigation ({url,tabId,title}), message (data), storage_change ({componentId,pageUrl,data}). APIs: conjure.storage.get/set/getAll, conjure.tabs.query/sendMessage, conjure.messaging.sendToContentScript/broadcast, conjure.db.* (createTables, put, get, getAll, update, delete, where, count, clear), conjure.log/error, conjure.setTimeout/setInterval. Do NOT use import/require.',
      schema: z.object({
        name: z.string().describe('Worker name (e.g. "PageTracker", "AutoNotifier")'),
        description: z.string().describe('Brief description of what the worker does'),
        code: z
          .string()
          .describe(
            'Worker code. Receives `conjure` object. Register event handlers with conjure.on(). Use conjure.setTimeout (NOT window.setTimeout). No imports.',
          ),
      }),
    },
  );
