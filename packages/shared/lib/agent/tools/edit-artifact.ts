import { getArtifact, updateArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export function createEditArtifactTool(ctx: ToolContext) {
  return tool(
    async ({ artifactId, newCode, instruction }) => {
      const artifact = await getArtifact(artifactId);
      if (!artifact) {
        return JSON.stringify({ success: false, error: `Artifact "${artifactId}" not found` });
      }

      await updateArtifact(artifactId, { code: newCode });

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
      description: 'Modify an existing artifact by providing updated code.',
      schema: z.object({
        artifactId: z.string().describe('The ID of the artifact to edit'),
        newCode: z.string().describe('The complete updated code for the artifact'),
        instruction: z.string().describe('Description of what was changed and why'),
      }),
    },
  );
}
