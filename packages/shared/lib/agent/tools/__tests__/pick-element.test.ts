import { describe, it, expect, vi } from 'vitest';
import { createPickElementTool } from '../pick-element.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';

describe('pick_element tool', () => {
  it('sends ACTIVATE_PICKER and waits for PICKER_RESULT', async () => {
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockResolvedValue(undefined),
      waitForMessage: vi.fn().mockResolvedValue({ selector: '#btn', tagName: 'BUTTON' }),
    });
    const tool = createPickElementTool(ctx);

    const resultJson = await tool.invoke({});
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.selector).toBe('#btn');
    expect(result.tagName).toBe('BUTTON');
    expect(ctx.waitForMessage).toHaveBeenCalledWith('PICKER_RESULT', 60000);
    expect(ctx.sendToContentScript).toHaveBeenCalledWith(123, { type: 'ACTIVATE_PICKER' });
  });

  it('returns cancelled when result is null', async () => {
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockResolvedValue(undefined),
      waitForMessage: vi.fn().mockResolvedValue(null),
    });
    const tool = createPickElementTool(ctx);

    const resultJson = await tool.invoke({});
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  it('returns error when no active tab', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createPickElementTool(ctx);

    const resultJson = await tool.invoke({});
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });

  it('handles timeout error', async () => {
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockResolvedValue(undefined),
      waitForMessage: vi.fn().mockRejectedValue(new Error('Timed out waiting for message')),
    });
    const tool = createPickElementTool(ctx);

    const resultJson = await tool.invoke({});
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });
});
