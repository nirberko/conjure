import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

interface MockResponse {
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
}

/**
 * Creates a mock chat model that returns scripted responses.
 * Each call to invoke() returns the next response in the queue.
 */
export const createMockChatModel = (responses: MockResponse[]) => {
  let callIndex = 0;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const invoke = async (_messages: BaseMessage[]) => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;

    const msg = new AIMessage({
      content: response.content,
      tool_calls: response.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
        type: 'tool_call' as const,
      })),
    });
    return msg;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const bindTools = (_tools: unknown[]) => ({ invoke, bindTools });

  return {
    invoke,
    bindTools,
  };
};
