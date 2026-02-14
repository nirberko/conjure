import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export function createInspectDomTool(ctx: ToolContext) {
  return tool(
    async ({ selector, depth }) => {
      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }
      try {
        const result = await ctx.sendToContentScript(ctx.tabId, {
          type: 'INSPECT_DOM',
          payload: { selector, depth },
        });
        return JSON.stringify({ success: true, dom: result });
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
    {
      name: 'inspect_page_dom',
      description:
        'Read the DOM structure from the active page. Returns an HTML snippet of the matched element(s). Use this to understand the page layout before generating artifacts.',
      schema: z.object({
        selector: z
          .string()
          .optional()
          .describe('CSS selector to inspect. If omitted, returns document.body overview.'),
        depth: z.number().default(3).describe('How many levels deep to traverse (default: 3)'),
      }),
    },
  );
}
