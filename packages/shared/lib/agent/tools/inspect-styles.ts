import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createInspectStylesTool = (ctx: ToolContext) =>
  tool(
    async ({ selector }) => {
      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }
      try {
        const result = await ctx.sendToContentScript(ctx.tabId, {
          type: 'INSPECT_STYLES',
          payload: { selector },
        });
        return JSON.stringify({ success: true, styles: result });
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
    {
      name: 'inspect_page_styles',
      description: 'Read computed CSS styles of an element on the active page.',
      schema: z.object({
        selector: z.string().describe('CSS selector of the element to inspect'),
      }),
    },
  );

export const createReadPageTextTool = (ctx: ToolContext) =>
  tool(
    async ({ selector }) => {
      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }
      try {
        const result = await ctx.sendToContentScript(ctx.tabId, {
          type: 'READ_PAGE_TEXT',
          payload: { selector },
        });
        return JSON.stringify({ success: true, text: result });
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
    {
      name: 'read_page_text',
      description: 'Get the text content of an element on the active page.',
      schema: z.object({
        selector: z.string().describe('CSS selector of the element to read text from'),
      }),
    },
  );
