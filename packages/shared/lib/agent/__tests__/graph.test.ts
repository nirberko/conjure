import { describe, it, expect } from 'vitest';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { sanitizeMessages } from '../graph.js';

describe('sanitizeMessages', () => {
  it('passes clean messages through unchanged', () => {
    const messages = [
      new HumanMessage('hello'),
      new AIMessage('hi there'),
    ];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(messages[0]);
    expect(result[1]).toBe(messages[1]);
  });

  it('keeps complete tool call sequences', () => {
    const aiMsg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'tc1', name: 'test_tool', args: {} }],
    });
    const toolMsg = new ToolMessage({
      content: 'result',
      tool_call_id: 'tc1',
    });
    const messages = [new HumanMessage('do something'), aiMsg, toolMsg];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(3);
  });

  it('removes dangling tool_calls with no matching tool response', () => {
    const aiMsg = new AIMessage({
      content: '',
      tool_calls: [
        { id: 'tc1', name: 'tool_a', args: {} },
        { id: 'tc2', name: 'tool_b', args: {} },
      ],
    });
    // Only one response — tc2 is missing
    const toolMsg = new ToolMessage({
      content: 'result',
      tool_call_id: 'tc1',
    });
    const messages = [new HumanMessage('do it'), aiMsg, toolMsg];

    const result = sanitizeMessages(messages);

    // The AI message with dangling tool_calls should be removed
    // The orphaned tool response should also be removed
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(messages[0]);
  });

  it('removes orphaned tool responses whose parent AI message was removed', () => {
    // Tool response with no matching parent
    const orphanedTool = new ToolMessage({
      content: 'orphaned result',
      tool_call_id: 'non-existent-tc',
    });
    const messages = [new HumanMessage('start'), orphanedTool];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(messages[0]);
  });

  it('handles multiple complete tool call sequences', () => {
    const ai1 = new AIMessage({
      content: '',
      tool_calls: [{ id: 'tc1', name: 'tool_a', args: {} }],
    });
    const tool1 = new ToolMessage({ content: 'r1', tool_call_id: 'tc1' });
    const ai2 = new AIMessage({
      content: '',
      tool_calls: [{ id: 'tc2', name: 'tool_b', args: {} }],
    });
    const tool2 = new ToolMessage({ content: 'r2', tool_call_id: 'tc2' });
    const messages = [new HumanMessage('go'), ai1, tool1, ai2, tool2];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(5);
  });

  it('handles empty array', () => {
    const result = sanitizeMessages([]);

    expect(result).toEqual([]);
  });

  it('handles AI message with empty tool_calls array', () => {
    const ai = new AIMessage({ content: 'just text', tool_calls: [] });
    const messages = [new HumanMessage('hi'), ai];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(2);
  });
});
