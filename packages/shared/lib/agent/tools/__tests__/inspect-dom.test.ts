import { describe, it, expect, vi } from 'vitest';
import { createInspectDomTool } from '../inspect-dom.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';

describe('inspect_page_dom tool', () => {
  it('sends INSPECT_DOM to content script', async () => {
    const sendToContentScript = vi.fn().mockResolvedValue('<div id="main">...</div>');
    const ctx = createMockToolContext({ sendToContentScript });
    const tool = createInspectDomTool(ctx);

    const resultJson = await tool.invoke({ selector: '#main', depth: 3 });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.dom).toBe('<div id="main">...</div>');
    expect(sendToContentScript).toHaveBeenCalledWith(123, {
      type: 'INSPECT_DOM',
      payload: { selector: '#main', depth: 3 },
    });
  });

  it('returns error when no active tab', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createInspectDomTool(ctx);

    const resultJson = await tool.invoke({ depth: 3 });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });

  it('handles content script errors', async () => {
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockRejectedValue(new Error('Tab closed')),
    });
    const tool = createInspectDomTool(ctx);

    const resultJson = await tool.invoke({ depth: 2 });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Tab closed');
  });
});
