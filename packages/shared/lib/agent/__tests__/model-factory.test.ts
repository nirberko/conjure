import { describe, it, expect } from 'vitest';
import { createChatModel, getDefaultModel, getAvailableModels } from '../model-factory.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

describe('createChatModel', () => {
  it('creates an OpenAI model', () => {
    const model = createChatModel({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4o',
    });

    expect(model).toBeInstanceOf(ChatOpenAI);
  });

  it('creates an Anthropic model', () => {
    const model = createChatModel({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-sonnet-4-20250514',
    });

    expect(model).toBeInstanceOf(ChatAnthropic);
  });

  it('creates a Google model', () => {
    const model = createChatModel({
      provider: 'google',
      apiKey: 'test-key',
      model: 'gemini-2.0-flash',
    });

    expect(model).toBeInstanceOf(ChatGoogleGenerativeAI);
  });

  it('uses default model when empty model string provided', () => {
    // Empty model string should fall back to default
    const model = createChatModel({
      provider: 'openai',
      apiKey: 'test-key',
      model: '',
    });

    expect(model).toBeInstanceOf(ChatOpenAI);
  });

  it('throws for unsupported provider', () => {
    expect(() =>
      createChatModel({
        provider: 'invalid' as any,
        apiKey: 'key',
        model: 'model',
      }),
    ).toThrow('Unsupported AI provider');
  });
});

describe('getDefaultModel', () => {
  it('returns gpt-4o for openai', () => {
    expect(getDefaultModel('openai')).toBe('gpt-4o');
  });

  it('returns claude-sonnet-4-20250514 for anthropic', () => {
    expect(getDefaultModel('anthropic')).toBe('claude-sonnet-4-20250514');
  });

  it('returns gemini-2.0-flash for google', () => {
    expect(getDefaultModel('google')).toBe('gemini-2.0-flash');
  });
});

describe('getAvailableModels', () => {
  it('returns openai models', () => {
    const models = getAvailableModels('openai');

    expect(models).toContain('gpt-4o');
    expect(models).toContain('gpt-4o-mini');
    expect(models.length).toBeGreaterThan(0);
  });

  it('returns anthropic models', () => {
    const models = getAvailableModels('anthropic');

    expect(models).toContain('claude-sonnet-4-20250514');
    expect(models.length).toBeGreaterThan(0);
  });

  it('returns google models', () => {
    const models = getAvailableModels('google');

    expect(models).toContain('gemini-2.0-flash');
    expect(models.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown provider', () => {
    expect(getAvailableModels('unknown' as any)).toEqual([]);
  });
});
