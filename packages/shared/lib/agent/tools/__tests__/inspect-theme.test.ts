import { createInspectThemeTool } from '../inspect-theme.js';
import { describe, it, expect, vi } from 'vitest';
import type { ToolContext } from '../../types.js';

const createMockToolContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  extensionId: 'test-ext',
  tabId: 123,
  sendToContentScript: vi.fn().mockResolvedValue({}),
  waitForMessage: vi.fn().mockResolvedValue({}),
  sendToServiceWorker: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe('inspect_page_theme tool', () => {
  it('returns error when no active tab', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createInspectThemeTool(ctx);

    const result = await tool.invoke({ selector: undefined });
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({ success: false, error: 'No active tab' });
    expect(ctx.sendToContentScript).not.toHaveBeenCalled();
  });

  it('sends INSPECT_THEME message without selector', async () => {
    const themeData = { colorPalette: [], typography: {} };
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockResolvedValue(themeData),
    });
    const tool = createInspectThemeTool(ctx);

    const result = await tool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({ success: true, theme: themeData });
    expect(ctx.sendToContentScript).toHaveBeenCalledWith(123, {
      type: 'INSPECT_THEME',
      payload: { selector: undefined },
    });
  });

  it('sends INSPECT_THEME message with selector', async () => {
    const themeData = { colorPalette: [{ color: '#fff', count: 10, usage: ['background'] }] };
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockResolvedValue(themeData),
    });
    const tool = createInspectThemeTool(ctx);

    const result = await tool.invoke({ selector: '#main-content' });
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({ success: true, theme: themeData });
    expect(ctx.sendToContentScript).toHaveBeenCalledWith(123, {
      type: 'INSPECT_THEME',
      payload: { selector: '#main-content' },
    });
  });

  it('handles content script errors gracefully', async () => {
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockRejectedValue(new Error('Content script not reachable')),
    });
    const tool = createInspectThemeTool(ctx);

    const result = await tool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({ success: false, error: 'Error: Content script not reachable' });
  });
});
