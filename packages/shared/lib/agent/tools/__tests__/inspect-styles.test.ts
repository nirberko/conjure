import { describe, it, expect, vi } from 'vitest';
import { createInspectStylesTool, createReadPageTextTool } from '../inspect-styles.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';

describe('inspect_page_styles tool', () => {
  it('sends INSPECT_STYLES to content script', async () => {
    const styles = { color: 'red', fontSize: '16px' };
    const sendToContentScript = vi.fn().mockResolvedValue(styles);
    const ctx = createMockToolContext({ sendToContentScript });
    const tool = createInspectStylesTool(ctx);

    const resultJson = await tool.invoke({ selector: '.header' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.styles).toEqual(styles);
    expect(sendToContentScript).toHaveBeenCalledWith(123, {
      type: 'INSPECT_STYLES',
      payload: { selector: '.header' },
    });
  });

  it('returns error when no active tab', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createInspectStylesTool(ctx);

    const resultJson = await tool.invoke({ selector: 'body' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });
});

describe('read_page_text tool', () => {
  it('sends READ_PAGE_TEXT to content script', async () => {
    const sendToContentScript = vi.fn().mockResolvedValue('Hello World');
    const ctx = createMockToolContext({ sendToContentScript });
    const tool = createReadPageTextTool(ctx);

    const resultJson = await tool.invoke({ selector: 'h1' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.text).toBe('Hello World');
    expect(sendToContentScript).toHaveBeenCalledWith(123, {
      type: 'READ_PAGE_TEXT',
      payload: { selector: 'h1' },
    });
  });

  it('returns error when no active tab', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createReadPageTextTool(ctx);

    const resultJson = await tool.invoke({ selector: 'p' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });
});
