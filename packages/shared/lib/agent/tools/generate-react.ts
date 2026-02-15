import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export function createGenerateReactTool(ctx: ToolContext) {
  return tool(
    async ({ name, description, code, elementXPath }) => {
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'react-component',
        name,
        code,
        elementXPath: elementXPath || undefined,
        enabled: true,
      });
      return JSON.stringify({
        success: true,
        artifactId: artifact.id,
        message: `React component "${name}" created successfully.${description ? ` Description: ${description}` : ''}`,
      });
    },
    {
      name: 'generate_react_component',
      description:
        'Generate a new React component artifact. When elementXPath is provided, the component is appended into every matching element (supports multiple). When omitted, mounts to document.body. Code is a function body with params (React, ReactDOM, context). MUST end with `return ComponentName;`. Use React.useState (not destructured). Use ONLY inline styles. Do NOT use import/require. context provides: getData(), setData(), pageUrl, sendMessage(), onWorkerMessage(), and db.* methods (createTables, put, get, getAll, update, delete, where, count, clear).',
      schema: z.object({
        name: z.string().describe('Component name (e.g. "NotesWidget")'),
        description: z.string().describe('Brief description of what the component does'),
        code: z
          .string()
          .describe(
            'Function body that defines a React component and ends with `return ComponentName;`. Use React.useState/useEffect directly. Inline styles only. No imports.',
          ),
        elementXPath: z
          .string()
          .optional()
          .describe(
            'Optional XPath expression for target element(s). If it matches multiple elements, the component is appended into each one. Example: "//div[@class=\'property-card\']". Omit for standalone components that mount to document.body.',
          ),
      }),
    },
  );
}
