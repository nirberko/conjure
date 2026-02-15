import { describe, it, expect, vi } from 'vitest';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { buildAgentGraph } from '../graph.js';
import type { ToolContext } from '../types.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

function createMockToolContext(): ToolContext {
  return {
    extensionId: 'test-ext',
    tabId: 1,
    sendToContentScript: vi.fn().mockResolvedValue(undefined),
    waitForMessage: vi.fn().mockResolvedValue(undefined),
    sendToServiceWorker: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock LLM that returns scripted responses in order.
 * Each response can optionally include tool_calls.
 */
function createMockLLM(
  responses: Array<{ content: string; tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }> }>,
) {
  let callIndex = 0;

  const invoke = vi.fn(async () => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;

    return new AIMessage({
      content: response.content,
      tool_calls: response.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
        type: 'tool_call' as const,
      })),
    });
  });

  const bindTools = vi.fn(() => ({
    invoke,
    bindTools,
  }));

  return {
    invoke,
    bindTools,
  } as unknown as BaseChatModel;
}

describe('Agent Graph Integration', () => {
  it('single turn: orchestrator → END (no tools)', async () => {
    const ctx = createMockToolContext();
    const model = createMockLLM([
      // Orchestrator response (no tool_calls → goes to END)
      { content: 'Hello! How can I help you today?' },
    ]);

    const graph = buildAgentGraph(model, ctx);
    const compiled = graph.compile();

    const result = await compiled.invoke({
      messages: [new HumanMessage('Hi')],
      extensionId: 'test-ext',
    });

    // Should have human + orchestrator response
    const msgs = result.messages;
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    // Last message should be the orchestrator's response
    const last = msgs[msgs.length - 1];
    expect(last.content).toBe('Hello! How can I help you today?');
  });

  it('tool call flow: orchestrator → tool_executor → orchestrator → END', async () => {
    const ctx = createMockToolContext();

    // We need 2 LLM calls:
    // 1. Orchestrator with tool_calls
    // 2. Orchestrator without tool_calls (final response)
    const model = createMockLLM([
      // 1. Orchestrator - calls inspect_page_dom
      {
        content: '',
        tool_calls: [
          { id: 'tc-1', name: 'inspect_page_dom', args: { depth: 3 } },
        ],
      },
      // 2. Orchestrator - final response
      { content: 'The page has a div element at the root.' },
    ]);

    // Mock the content script response for inspect_dom
    ctx.sendToContentScript = vi.fn().mockResolvedValue('<div>root</div>');

    const graph = buildAgentGraph(model, ctx);
    const compiled = graph.compile();

    const result = await compiled.invoke({
      messages: [new HumanMessage('What does the page look like?')],
      extensionId: 'test-ext',
    });

    const msgs = result.messages;
    // Should have: Human, AI (tool_calls), Tool response, AI (final)
    expect(msgs.length).toBeGreaterThanOrEqual(4);

    // Find the tool message
    const toolMsgs = msgs.filter((m: any) => m._getType?.() === 'tool' || m.role === 'tool');
    expect(toolMsgs.length).toBeGreaterThanOrEqual(1);

    // Last message should be the final response
    const last = msgs[msgs.length - 1];
    expect(last.content).toBe('The page has a div element at the root.');

    // Verify iteration count increased
    expect(result.iterationCount).toBeGreaterThanOrEqual(2);
  });

  it('unknown tool returns error message', async () => {
    const ctx = createMockToolContext();

    const model = createMockLLM([
      // 1. Orchestrator - calls nonexistent tool
      {
        content: '',
        tool_calls: [
          { id: 'tc-1', name: 'nonexistent_tool', args: {} },
        ],
      },
      // 2. Orchestrator - final response
      { content: 'Sorry, I tried a tool that does not exist.' },
    ]);

    const graph = buildAgentGraph(model, ctx);
    const compiled = graph.compile();

    const result = await compiled.invoke({
      messages: [new HumanMessage('Do something')],
      extensionId: 'test-ext',
    });

    // Find the tool error message
    const toolMsgs = result.messages.filter(
      (m: any) => m._getType?.() === 'tool' || m.role === 'tool',
    );
    expect(toolMsgs.length).toBeGreaterThanOrEqual(1);
    const toolContent = typeof toolMsgs[0].content === 'string' ? toolMsgs[0].content : '';
    expect(toolContent).toContain('Unknown tool');
  });

  it('tool errors are caught and returned as tool messages', async () => {
    const ctx = createMockToolContext();
    // Make sendToContentScript throw to simulate an error in inspect_page_dom
    ctx.sendToContentScript = vi.fn().mockRejectedValue(new Error('Tab not found'));

    const model = createMockLLM([
      // 1. Orchestrator - calls inspect_page_dom
      {
        content: '',
        tool_calls: [
          { id: 'tc-1', name: 'inspect_page_dom', args: { depth: 2 } },
        ],
      },
      // 2. Orchestrator - final response
      { content: 'I could not inspect the page.' },
    ]);

    const graph = buildAgentGraph(model, ctx);
    const compiled = graph.compile();

    const result = await compiled.invoke({
      messages: [new HumanMessage('Inspect page')],
      extensionId: 'test-ext',
    });

    // Should complete without throwing
    const last = result.messages[result.messages.length - 1];
    expect(last.content).toBe('I could not inspect the page.');

    // The tool message should contain the error
    const toolMsgs = result.messages.filter(
      (m: any) => m._getType?.() === 'tool' || m.role === 'tool',
    );
    expect(toolMsgs.length).toBeGreaterThanOrEqual(1);
    // The tool returns JSON with success: false (it catches internally)
    const parsed = JSON.parse(toolMsgs[0].content as string);
    expect(parsed.success).toBe(false);
  });
});
