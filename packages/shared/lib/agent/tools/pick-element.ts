import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export function createPickElementTool(ctx: ToolContext) {
  return tool(
    async () => {
      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }

      try {
        // Start listening for the result BEFORE activating the picker to avoid race conditions
        const resultPromise = ctx.waitForMessage('PICKER_RESULT', 60000);

        // Activate the picker overlay in the content script
        await ctx.sendToContentScript(ctx.tabId, { type: 'ACTIVATE_PICKER' });

        // Wait for the user to pick an element (or cancel/timeout)
        const payload = (await resultPromise) as { selector: string; tagName: string } | null;

        if (payload === null) {
          return JSON.stringify({
            success: false,
            cancelled: true,
            message: 'User cancelled the element picker (pressed Escape).',
          });
        }

        return JSON.stringify({
          success: true,
          selector: payload.selector,
          tagName: payload.tagName,
        });
      } catch (error) {
        const msg = String(error);
        if (msg.includes('Timed out')) {
          return JSON.stringify({
            success: false,
            error: 'Element picker timed out after 60 seconds. The user did not select an element.',
          });
        }
        return JSON.stringify({ success: false, error: msg });
      }
    },
    {
      name: 'pick_element',
      description:
        'Activate the visual element picker on the page and wait for the user to select an element. Returns the CSS selector and tag name of the selected element. The picker will timeout after 60 seconds if no element is selected.',
      schema: z.object({}),
    },
  );
}
