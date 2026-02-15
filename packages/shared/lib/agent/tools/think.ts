import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export function createThinkTool() {
  return tool(
    async ({ thought }) => {
      return JSON.stringify({ success: true, thought });
    },
    {
      name: 'think',
      description:
        'MANDATORY: You must call this tool FIRST before any other tool on every request. Use it to think through your approach, plan your steps, reason about architecture, and decide on the best course of action.',
      schema: z.object({
        thought: z.string().describe(
          'Your step-by-step reasoning: analyze the current state, what has been done, and decide the next concrete steps.',
        ),
      }),
    },
  );
}
