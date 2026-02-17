import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';

export const createGenerateReactTool = (ctx: ToolContext) =>
  tool(
    async ({ name, description, code, elementXPath, dependencies }) => {
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'react-component',
        name,
        code,
        elementXPath: elementXPath || undefined,
        dependencies: dependencies || undefined,
        enabled: true,
      });
      return JSON.stringify({
        success: true,
        artifactId: artifact.id,
        message: `React component "${name}" created successfully.${description ? ` Description: ${description}` : ''}${
          dependencies
            ? ` Dependencies: ${Object.entries(dependencies)
                .map(([k, v]) => `${k}@${v}`)
                .join(', ')}`
            : ''
        }`,
      });
    },
    {
      name: 'generate_react_component',
      description:
        'Generate a new React component artifact. When elementXPath is provided, the component is appended into every matching element (supports multiple). When omitted, mounts to document.body. When dependencies are provided, the component runs as an ES module with import map support — use standard `import` syntax. Without dependencies, code is a function body with params (React, ReactDOM, context) and MUST end with `return ComponentName;`. Use React.useState (not destructured). Use ONLY inline styles. context provides: getData(), setData(), pageUrl, sendMessage(), onWorkerMessage(), and db.* methods.',
      schema: z.object({
        name: z.string().describe('Component name (e.g. "NotesWidget")'),
        description: z.string().describe('Brief description of what the component does'),
        code: z
          .string()
          .describe(
            'Component code. If dependencies are provided, use `import` statements (React/ReactDOM are auto-imported). If no dependencies, write a function body ending with `return ComponentName;`. Inline styles only.',
          ),
        elementXPath: z
          .string()
          .optional()
          .describe(
            'Optional XPath expression for target element(s). If it matches multiple elements, the component is appended into each one. Omit for standalone components that mount to document.body.',
          ),
        dependencies: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            'Optional map of npm packages to pinned versions. Use add_dependency tool first to resolve versions, then pass them here. Example: {"recharts": "2.15.0", "date-fns": "4.1.0"}',
          ),
      }),
    },
  );
