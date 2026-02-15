import { describe, it, expect } from 'vitest';
import { createThinkTool } from '../think.js';

describe('createThinkTool', () => {
  it('returns tool with name "think"', () => {
    const tool = createThinkTool();
    expect(tool.name).toBe('think');
  });

  it('returns success with the thought echoed back', async () => {
    const tool = createThinkTool();
    const result = await tool.invoke({ thought: 'I should inspect the DOM first.' });
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({
      success: true,
      thought: 'I should inspect the DOM first.',
    });
  });
});
