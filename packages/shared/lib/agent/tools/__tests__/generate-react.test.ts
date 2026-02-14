import { describe, it, expect } from 'vitest';
import { createGenerateReactTool } from '../generate-react.js';
import { createMockToolContext } from '../../../__testing__/tool-context-mock.js';
import { getArtifact } from '../../../db/index.js';

describe('generate_react_component tool', () => {
  it('creates a react-component artifact in the DB', async () => {
    const ctx = createMockToolContext();
    const tool = createGenerateReactTool(ctx);

    const resultJson = await tool.invoke({
      name: 'TestWidget',
      description: 'A test widget',
      code: 'function TestWidget() { return <div>Hi</div>; }\nreturn TestWidget;',
      cssSelector: '#root',
      injectionMode: 'append',
    });

    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.artifactId).toBeDefined();

    const artifact = await getArtifact(result.artifactId);
    expect(artifact).toBeDefined();
    expect(artifact!.type).toBe('react-component');
    expect(artifact!.extensionId).toBe('test-extension-id');
    expect(artifact!.name).toBe('TestWidget');
    expect(artifact!.code).toContain('TestWidget');
    expect(artifact!.cssSelector).toBe('#root');
    expect(artifact!.injectionMode).toBe('append');
    expect(artifact!.codeVersions).toHaveLength(1);
  });

  it('returns success message with description', async () => {
    const ctx = createMockToolContext();
    const tool = createGenerateReactTool(ctx);

    const resultJson = await tool.invoke({
      name: 'Widget',
      description: 'Shows data',
      code: 'function W() { return <div/>; }\nreturn W;',
      cssSelector: 'body',
      injectionMode: 'prepend',
    });

    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Widget');
    expect(result.message).toContain('Shows data');
  });
});
