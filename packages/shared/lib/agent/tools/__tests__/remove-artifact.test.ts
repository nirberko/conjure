import { describe, it, expect } from 'vitest';
import { createRemoveArtifactTool } from '../remove-artifact.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';
import { createArtifact } from '../../../db/index.js';

describe('remove_artifact tool', () => {
  it('sends REMOVE_ARTIFACT to content script', async () => {
    const ctx = createMockToolContext();
    const tool = createRemoveArtifactTool(ctx);

    const artifact = await createArtifact({
      extensionId: ctx.extensionId,
      type: 'react-component',
      name: 'Widget',
      code: 'return () => null;',
      enabled: true,
    });

    const resultJson = await tool.invoke({ artifactId: artifact.id });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(ctx.sendToContentScript).toHaveBeenCalledWith(123, {
      type: 'REMOVE_ARTIFACT',
      payload: { id: artifact.id },
    });
  });

  it('returns error for non-existent artifact', async () => {
    const ctx = createMockToolContext();
    const tool = createRemoveArtifactTool(ctx);

    const resultJson = await tool.invoke({ artifactId: 'does-not-exist' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error when no active tab', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createRemoveArtifactTool(ctx);

    const resultJson = await tool.invoke({ artifactId: 'any-id' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });
});
