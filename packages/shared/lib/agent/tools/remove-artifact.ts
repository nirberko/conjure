import { getArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createRemoveArtifactTool = (ctx: ToolContext) =>
  tool(
    async ({ artifactId }) => {
      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }

      const artifact = await getArtifact(artifactId);
      if (!artifact) {
        return JSON.stringify({ success: false, error: `Artifact "${artifactId}" not found` });
      }

      try {
        await ctx.sendToContentScript(ctx.tabId, {
          type: 'REMOVE_ARTIFACT',
          payload: { id: artifactId },
        });
        return JSON.stringify({
          success: true,
          artifactId,
          message: `Artifact "${artifact.name}" removed from page.`,
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
    {
      name: 'remove_artifact',
      description: 'Remove an injected artifact from the active page.',
      schema: z.object({
        artifactId: z.string().describe('The ID of the artifact to remove'),
      }),
    },
  );
