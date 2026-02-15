import { getArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createDeployArtifactTool = (ctx: ToolContext) =>
  tool(
    async ({ artifactId }) => {
      const artifact = await getArtifact(artifactId);
      if (!artifact) {
        return JSON.stringify({ success: false, error: `Artifact "${artifactId}" not found` });
      }

      // Background workers are started via the service worker, not injected into a tab
      if (artifact.type === 'background-worker') {
        try {
          const result = await ctx.sendToServiceWorker({
            type: 'START_BACKGROUND_WORKER',
            payload: { artifactId },
          });
          return JSON.stringify({
            success: true,
            artifactId,
            message: `Background worker "${artifact.name}" started.`,
            result,
          });
        } catch (error) {
          return JSON.stringify({ success: false, error: String(error) });
        }
      }

      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }

      try {
        const result = await ctx.sendToContentScript(ctx.tabId, {
          type: 'INJECT_ARTIFACT',
          payload: artifact,
        });
        return JSON.stringify({
          success: true,
          artifactId,
          message: `Artifact "${artifact.name}" deployed to page.`,
          result,
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
    {
      name: 'deploy_artifact',
      description: 'Deploy (inject) an artifact into the active page, or start a background worker.',
      schema: z.object({
        artifactId: z.string().describe('The ID of the artifact to deploy'),
      }),
    },
  );
