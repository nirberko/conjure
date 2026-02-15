import { describe, it, expect } from 'vitest';
import { createGenerateBackgroundWorkerTool } from '../generate-background-worker.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';
import { getArtifact } from '../../../db/index.js';

describe('generate_background_worker tool', () => {
  it('creates a background-worker artifact in the DB', async () => {
    const ctx = createMockToolContext();
    const tool = createGenerateBackgroundWorkerTool(ctx);

    const resultJson = await tool.invoke({
      name: 'PageTracker',
      description: 'Tracks page navigation',
      code: 'conjure.on("url_navigation", (e) => conjure.log(e.url));',
    });

    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.artifactId).toBeDefined();
    expect(result.message).toContain('deploy_artifact');

    const artifact = await getArtifact(result.artifactId);
    expect(artifact).toBeDefined();
    expect(artifact!.type).toBe('background-worker');
    expect(artifact!.name).toBe('PageTracker');
    expect(artifact!.codeVersions).toHaveLength(1);
  });
});
