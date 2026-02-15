import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export function createThinkTool() {
  return tool(
    async ({ goal, pageInteraction, domNeeded, artifactType, plan }) => {
      return JSON.stringify({ success: true, goal, pageInteraction, domNeeded, artifactType, plan });
    },
    {
      name: 'think',
      description:
        'MANDATORY: You must call this tool FIRST before any other tool on every request. Use it to think through your approach, plan your steps, reason about architecture, and decide on the best course of action.',
      schema: z.object({
        goal: z.string().describe('What the user is asking for (one sentence)'),
        pageInteraction: z
          .boolean()
          .describe('Does this involve existing page elements?'),
        domNeeded: z
          .boolean()
          .describe('Do I need to inspect the DOM before generating code?'),
        artifactType: z
          .enum([
            'react-component',
            'js-script',
            'css',
            'background-worker',
            'edit',
            'none',
          ])
          .describe('Which artifact type fits this request'),
        plan: z
          .string()
          .describe(
            'Step-by-step plan: list each tool call you will make in order',
          ),
      }),
    },
  );
}
