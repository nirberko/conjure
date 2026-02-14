import { createArtifact } from '../../db/index.js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { InjectionMode } from '../../types/index.js';
import type { ToolContext } from '../types.js';

export function createGenerateReactTool(ctx: ToolContext) {
  return tool(
    async ({ name, description, code, cssSelector, injectionMode }) => {
      const artifact = await createArtifact({
        extensionId: ctx.extensionId,
        type: 'react-component',
        name,
        code,
        cssSelector,
        injectionMode: injectionMode as InjectionMode,
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
        'Generate a new React component artifact. The code is a function body with params (React, ReactDOM, context). It MUST define a function component and end with `return ComponentName;`. Example: `function Hello() { return <div>Hi</div>; }\nreturn Hello;`',
      schema: z.object({
        name: z.string().describe('Component name (e.g. "NotesWidget")'),
        description: z.string().describe('Brief description of what the component does'),
        code: z
          .string()
          .describe(
            'Function body: define a React component, then `return ComponentName;` at the end. MUST end with a return statement.',
          ),
        cssSelector: z.string().describe('CSS selector for the target element to inject near'),
        injectionMode: z
          .enum(['append', 'prepend', 'after', 'before'])
          .default('append')
          .describe('How to inject relative to the target element'),
      }),
    },
  );
}
