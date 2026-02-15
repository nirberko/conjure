import { describe, it, expect } from 'vitest';
import { createGenerateJsTool } from '../generate-js.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';
import { getArtifact } from '../../../db/index.js';

describe('generate_js_script tool', () => {
  it('creates a js-script artifact in the DB', async () => {
    const ctx = createMockToolContext();
    const tool = createGenerateJsTool(ctx);

    const resultJson = await tool.invoke({
      name: 'AutoScroller',
      description: 'Scrolls the page',
      code: 'window.scrollTo(0, document.body.scrollHeight);',
    });

    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.artifactId).toBeDefined();

    const artifact = await getArtifact(result.artifactId);
    expect(artifact).toBeDefined();
    expect(artifact!.type).toBe('js-script');
    expect(artifact!.name).toBe('AutoScroller');
    expect(artifact!.code).toContain('scrollTo');
    expect(artifact!.codeVersions).toHaveLength(1);
  });

});
