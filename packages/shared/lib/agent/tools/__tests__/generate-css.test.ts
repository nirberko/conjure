import { describe, it, expect } from 'vitest';
import { createGenerateCssTool } from '../generate-css.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';
import { getArtifact } from '../../../db/index.js';

describe('generate_css tool', () => {
  it('creates a css artifact in the DB', async () => {
    const ctx = createMockToolContext();
    const tool = createGenerateCssTool(ctx);

    const resultJson = await tool.invoke({
      name: 'DarkMode',
      description: 'Dark mode override',
      cssRules: 'body { background: #1a1a1a; color: #fff; }',
    });

    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.artifactId).toBeDefined();

    const artifact = await getArtifact(result.artifactId);
    expect(artifact).toBeDefined();
    expect(artifact!.type).toBe('css');
    expect(artifact!.name).toBe('DarkMode');
    expect(artifact!.code).toContain('background');
    expect(artifact!.codeVersions).toHaveLength(1);
  });
});
