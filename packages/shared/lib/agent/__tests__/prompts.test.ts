import { describe, it, expect } from 'vitest';
import {
  AGENT_SYSTEM_PROMPT,
  getAgentSystemPrompt,
} from '../prompts.js';

describe('getAgentSystemPrompt', () => {
  it('returns base prompt with no arguments', () => {
    const result = getAgentSystemPrompt();

    expect(result).toBe(AGENT_SYSTEM_PROMPT);
  });

  it('includes page URL when provided', () => {
    const result = getAgentSystemPrompt('https://example.com');

    expect(result).toContain('## Current Page Context');
    expect(result).toContain('URL: https://example.com');
  });

  it('includes page title when provided', () => {
    const result = getAgentSystemPrompt(undefined, 'Test Page');

    expect(result).toContain('## Current Page Context');
    expect(result).toContain('Title: Test Page');
  });

  it('includes both URL and title', () => {
    const result = getAgentSystemPrompt('https://example.com', 'Test Page');

    expect(result).toContain('URL: https://example.com');
    expect(result).toContain('Title: Test Page');
  });

  it('excludes page context section when no URL or title', () => {
    const result = getAgentSystemPrompt();

    expect(result).not.toContain('## Current Page Context');
  });

  it('includes think tool guidance in workflow', () => {
    const result = getAgentSystemPrompt();

    expect(result).toContain('calling the `think` tool');
  });

  it('includes When to Think section', () => {
    const result = getAgentSystemPrompt();

    expect(result).toContain('## When to Think');
  });
});
