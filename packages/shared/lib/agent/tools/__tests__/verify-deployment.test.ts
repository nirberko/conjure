import { describe, it, expect, vi } from 'vitest';
import { createVerifyDeploymentTool } from '../verify-deployment.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';

describe('verify_deployment tool', () => {
  it('sends VERIFY_DEPLOYMENT to content script', async () => {
    const verification = { found: true, visible: true };
    const sendToContentScript = vi.fn().mockResolvedValue(verification);
    const ctx = createMockToolContext({ sendToContentScript });
    const tool = createVerifyDeploymentTool(ctx);

    const resultJson = await tool.invoke({
      artifactId: 'art-1',
      expectedSelector: '#widget-root',
    });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(result.verification).toEqual(verification);
    expect(sendToContentScript).toHaveBeenCalledWith(123, {
      type: 'VERIFY_DEPLOYMENT',
      payload: { artifactId: 'art-1', expectedSelector: '#widget-root' },
    });
  });

  it('returns error when no active tab', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createVerifyDeploymentTool(ctx);

    const resultJson = await tool.invoke({ artifactId: 'art-1' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });

  it('handles content script errors', async () => {
    const ctx = createMockToolContext({
      sendToContentScript: vi.fn().mockRejectedValue(new Error('Connection lost')),
    });
    const tool = createVerifyDeploymentTool(ctx);

    const resultJson = await tool.invoke({ artifactId: 'art-1' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection lost');
  });
});
