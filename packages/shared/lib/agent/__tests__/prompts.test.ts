import { describe, it, expect } from 'vitest';
import {
  AGENT_SYSTEM_PROMPT,
  getAgentSystemPrompt,
  PLANNER_SYSTEM_PROMPT,
  getPlannerSystemPrompt,
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

  it('includes plan when provided', () => {
    const result = getAgentSystemPrompt(undefined, undefined, 'Step 1: Do thing');

    expect(result).toContain('## Current Plan');
    expect(result).toContain('Step 1: Do thing');
  });

  it('excludes plan section when plan is null', () => {
    const result = getAgentSystemPrompt(undefined, undefined, null);

    expect(result).not.toContain('## Current Plan');
  });

  it('excludes page context section when no URL or title', () => {
    const result = getAgentSystemPrompt();

    expect(result).not.toContain('## Current Page Context');
  });
});

describe('getPlannerSystemPrompt', () => {
  it('returns base prompt with no arguments', () => {
    const result = getPlannerSystemPrompt();

    expect(result).toBe(PLANNER_SYSTEM_PROMPT);
  });

  it('includes page context when provided', () => {
    const result = getPlannerSystemPrompt('https://example.com', 'My Page');

    expect(result).toContain('Current page context:');
    expect(result).toContain('URL: https://example.com');
    expect(result).toContain('Title: My Page');
  });

  it('includes previous plan when provided', () => {
    const result = getPlannerSystemPrompt(undefined, undefined, 'Previous analysis');

    expect(result).toContain('Previous plan:');
    expect(result).toContain('Previous analysis');
  });

  it('excludes plan section when plan is null', () => {
    const result = getPlannerSystemPrompt(undefined, undefined, null);

    expect(result).not.toContain('Previous plan:');
  });
});
