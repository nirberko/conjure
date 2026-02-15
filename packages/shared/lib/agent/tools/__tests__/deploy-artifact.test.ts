import { describe, it, expect, vi } from 'vitest';
import { createDeployArtifactTool } from '../deploy-artifact.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';
import { createArtifact } from '../../../db/index.js';

describe('deploy_artifact tool', () => {
  it('returns error for non-existent artifact', async () => {
    const ctx = createMockToolContext();
    const tool = createDeployArtifactTool(ctx);

    const resultJson = await tool.invoke({ artifactId: 'non-existent' });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('sends START_BACKGROUND_WORKER for background workers', async () => {
    const ctx = createMockToolContext();
    const tool = createDeployArtifactTool(ctx);

    const artifact = await createArtifact({
      extensionId: ctx.extensionId,
      type: 'background-worker',
      name: 'TestWorker',
      code: 'conjure.log("started");',
      enabled: true,
    });

    const resultJson = await tool.invoke({ artifactId: artifact.id });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(ctx.sendToServiceWorker).toHaveBeenCalledWith({
      type: 'START_BACKGROUND_WORKER',
      payload: { artifactId: artifact.id },
    });
  });

  it('sends INJECT_ARTIFACT for non-worker artifacts', async () => {
    const ctx = createMockToolContext();
    const tool = createDeployArtifactTool(ctx);

    const artifact = await createArtifact({
      extensionId: ctx.extensionId,
      type: 'react-component',
      name: 'TestComponent',
      code: 'function C() { return <div/>; }\nreturn C;',
      enabled: true,
    });

    const resultJson = await tool.invoke({ artifactId: artifact.id });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(true);
    expect(ctx.sendToContentScript).toHaveBeenCalledWith(123, expect.objectContaining({
      type: 'INJECT_ARTIFACT',
    }));
  });

  it('returns error when no active tab for non-worker artifacts', async () => {
    const ctx = createMockToolContext({ tabId: undefined });
    const tool = createDeployArtifactTool(ctx);

    const artifact = await createArtifact({
      extensionId: ctx.extensionId,
      type: 'js-script',
      name: 'TestScript',
      code: 'console.log("hi");',
      enabled: true,
    });

    const resultJson = await tool.invoke({ artifactId: artifact.id });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active tab');
  });

  it('handles sendToServiceWorker rejection gracefully', async () => {
    const ctx = createMockToolContext({
      sendToServiceWorker: vi.fn().mockRejectedValue(new Error('Worker failed')),
    });
    const tool = createDeployArtifactTool(ctx);

    const artifact = await createArtifact({
      extensionId: ctx.extensionId,
      type: 'background-worker',
      name: 'FailWorker',
      code: 'conjure.log("fail");',
      enabled: true,
    });

    const resultJson = await tool.invoke({ artifactId: artifact.id });
    const result = JSON.parse(resultJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Worker failed');
  });
});
