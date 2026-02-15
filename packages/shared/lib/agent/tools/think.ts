import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const createThinkTool = () =>
  tool(
    async ({ goal, pageInteraction, domNeeded, artifactType, steps, existingArtifacts, risks }) =>
      JSON.stringify({
        success: true,
        goal,
        pageInteraction,
        domNeeded,
        artifactType,
        steps,
        existingArtifacts,
        risks,
      }),
    {
      name: 'think',
      description:
        'MANDATORY: You must call this tool FIRST before any other tool on every request. Use it to think through your approach, plan your steps, reason about architecture, and decide on the best course of action.',
      schema: z.object({
        goal: z.string().describe('What the user is asking for (one sentence)'),
        pageInteraction: z.boolean().describe('Does this involve existing page elements?'),
        domNeeded: z.boolean().describe('Do I need to inspect the DOM before generating code?'),
        artifactType: z
          .enum(['react-component', 'js-script', 'css', 'background-worker', 'edit', 'none'])
          .describe('Which artifact type fits this request'),
        steps: z
          .array(
            z.object({
              tool: z.string().describe('Tool name to call'),
              reasoning: z.string().describe('Why this step is needed'),
            }),
          )
          .describe('Ordered list of tool calls with reasoning for each step'),
        existingArtifacts: z
          .string()
          .optional()
          .describe('Which existing artifacts are relevant? Should I edit one instead of creating new?'),
        risks: z
          .string()
          .optional()
          .describe(
            'What could go wrong? (e.g. element inside iframe, nested interactive elements, XPath may match multiple nodes)',
          ),
      }),
    },
  );
