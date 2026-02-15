import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createInspectThemeTool = (ctx: ToolContext) =>
  tool(
    async ({ selector }) => {
      if (!ctx.tabId) {
        return JSON.stringify({ success: false, error: 'No active tab' });
      }
      try {
        const result = await ctx.sendToContentScript(ctx.tabId, {
          type: 'INSPECT_THEME',
          payload: { selector },
        });
        return JSON.stringify({ success: true, theme: result });
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
    {
      name: 'inspect_page_theme',
      description:
        "Analyze the page's visual design system — extracts color palette, typography scale, spacing patterns, border/shadow conventions, CSS custom properties, and interactive element styles. Use this to generate components that match the target website's look and feel.",
      schema: z.object({
        selector: z
          .string()
          .optional()
          .describe('Optional CSS selector to scope the analysis to a page region. Defaults to the full page.'),
      }),
    },
  );
