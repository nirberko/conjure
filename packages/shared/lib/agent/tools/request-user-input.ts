import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolContext } from '../types.js';
import { REQUEST_USER_INPUT_TOOL_NAME } from '../../types/index.js';
import { extensionDBManager } from '../../db/index.js';

export { REQUEST_USER_INPUT_TOOL_NAME };

export function createRequestUserInputTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      try {
        const resultPromise = ctx.waitForMessage('USER_INPUT_RESULT', 300000);

        const payload = (await resultPromise) as Record<string, string | number> | null;

        if (payload === null) {
          return JSON.stringify({
            success: false,
            cancelled: true,
            message: 'User cancelled the input form.',
          });
        }

        // Auto-store env vars for fields with envKey before redaction
        const envFields = input.fields.filter(f => f.envKey);
        const envVarsStored: string[] = [];
        if (envFields.length > 0 && ctx.extensionId) {
          const existing = ((await extensionDBManager.storageGet(ctx.extensionId, '_env')) ?? {}) as Record<string, string>;
          for (const field of envFields) {
            const val = payload[field.name];
            if (val !== undefined && val !== null && field.envKey) {
              existing[field.envKey] = String(val);
              envVarsStored.push(field.envKey);
            }
          }
          await extensionDBManager.storageSet(ctx.extensionId, '_env', existing);
        }

        // Redact password field values so they don't persist in conversation history
        const redacted: Record<string, string | number> = {};
        const passwordFields = new Set(
          input.fields.filter(f => f.type === 'password').map(f => f.name),
        );
        for (const [key, value] of Object.entries(payload)) {
          redacted[key] = passwordFields.has(key) ? '***' : value;
        }

        return JSON.stringify({
          success: true,
          values: redacted,
          ...(envVarsStored.length > 0 ? { envVarsStored } : {}),
        });
      } catch (error) {
        const msg = String(error);
        if (msg.includes('Timed out')) {
          return JSON.stringify({
            success: false,
            error: 'User input form timed out after 5 minutes. The user did not submit.',
          });
        }
        return JSON.stringify({ success: false, error: msg });
      }
    },
    {
      name: REQUEST_USER_INPUT_TOOL_NAME,
      description:
        'Display a form to the user to collect structured input (e.g. API keys, configuration values, credentials). The form will be shown in the chat UI and the tool will wait for the user to submit or cancel. Password fields are automatically redacted in the response. Use this whenever you need the user to provide configuration values, secrets, or structured data.',
      schema: z.object({
        fields: z
          .array(
            z.object({
              name: z.string().describe('Unique field identifier (used as the key in the returned values)'),
              label: z.string().describe('Human-readable label displayed above the input'),
              type: z.enum(['text', 'password', 'number']).describe('Input type'),
              required: z.boolean().optional().describe('Whether the field is required (default: false)'),
              description: z.string().optional().describe('Help text displayed below the input'),
              placeholder: z.string().optional().describe('Placeholder text for the input'),
              envKey: z.string().optional().describe('If set, the field value will be auto-stored as an environment variable with this key name (accessible via conjure.env.get() in workers or context.env.get() in components). Use this for API keys and secrets so they are securely stored and available to artifacts without appearing in conversation history.'),
            }),
          )
          .describe('Array of input fields to display in the form'),
        title: z.string().optional().describe('Optional title displayed at the top of the form'),
        submitLabel: z.string().optional().describe('Custom label for the submit button (default: "Submit")'),
      }),
    },
  );
}
