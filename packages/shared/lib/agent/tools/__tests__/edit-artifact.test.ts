import { describe, it, expect } from 'vitest';
import { createEditArtifactTool } from '../edit-artifact.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';
import { createArtifact, getArtifact } from '../../../db/index.js';

describe('edit_artifact tool', () => {
  it('updates code in DB and appends to codeVersions', async () => {
    const ctx = createMockToolContext();
    const tool = createEditArtifactTool(ctx);

    const artifact = await createArtifact({
      extensionId: ctx.extensionId,
      type: 'react-component',
      name: 'Widget',
      code: 'function W() { return <div>v1</div>; }\nreturn W;',
      enabled: true,
    });

    const newCode = 'function W() { return <div>v2</div>; }\nreturn W;';
    const resultJson = await tool.invoke({
      artifactId: artifact.id,
      newCode,
      instruction: 'Updated text to v2',
    });

    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);

    const updated = await getArtifact(artifact.id);
    expect(updated!.code).toBe(newCode);
    expect(updated!.codeVersions).toHaveLength(2);
    expect(updated!.codeVersions[1].code).toBe(newCode);
  });

  it('returns error for non-existent artifact', async () => {
    const ctx = createMockToolContext();
    const tool = createEditArtifactTool(ctx);

    const resultJson = await tool.invoke({
      artifactId: 'does-not-exist',
      newCode: 'code',
      instruction: 'test',
    });

    const result = JSON.parse(resultJson);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('hot-reloads background workers after edit', async () => {
    const ctx = createMockToolContext();
    const tool = createEditArtifactTool(ctx);

    const artifact = await createArtifact({
      extensionId: ctx.extensionId,
      type: 'background-worker',
      name: 'Worker',
      code: 'conjure.log("v1");',
      enabled: true,
    });

    await tool.invoke({
      artifactId: artifact.id,
      newCode: 'conjure.log("v2");',
      instruction: 'Updated log',
    });

    expect(ctx.sendToServiceWorker).toHaveBeenCalledWith({
      type: 'RELOAD_BACKGROUND_WORKER',
      payload: { artifactId: artifact.id },
    });
  });
});
