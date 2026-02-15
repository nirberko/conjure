import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createVerifyDeploymentTool = (ctx: ToolContext) =>
  tool(
    async ({ artifactId, expectedSelector }) => {
      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }

      try {
        const result = await ctx.sendToContentScript(ctx.tabId, {
          type: 'VERIFY_DEPLOYMENT',
          payload: { artifactId, expectedSelector },
        });
        return JSON.stringify({ success: true, verification: result });
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
    {
      name: 'verify_deployment',
      description: 'Check that a deployed artifact is present and functioning on the page.',
      schema: z.object({
        artifactId: z.string().describe('The ID of the artifact to verify'),
        expectedSelector: z.string().optional().describe('Optional CSS selector that should exist after deployment'),
      }),
    },
  );
