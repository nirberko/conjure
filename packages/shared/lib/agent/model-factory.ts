import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import type { AIProvider } from '../types/index.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash',
};

const createChatModel = (config: ProviderConfig): BaseChatModel => {
  const model = config.model || DEFAULT_MODELS[config.provider];
  console.log('[Conjure Model] Creating model:', config.provider, model);

  switch (config.provider) {
    case 'openai':
      return new ChatOpenAI({
        apiKey: config.apiKey,
        model,
      });

    case 'anthropic':
      return new ChatAnthropic({
        apiKey: config.apiKey,
        model,
      });

    case 'google':
      return new ChatGoogleGenerativeAI({
        apiKey: config.apiKey,
        model,
      });

    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
};

const getDefaultModel = (provider: AIProvider): string => DEFAULT_MODELS[provider];

const getAvailableModels = (provider: AIProvider): string[] => {
  switch (provider) {
    case 'openai':
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
    case 'anthropic':
      return ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'];
    case 'google':
      return ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'];
    default:
      return [];
  }
};

export { createChatModel, getDefaultModel, getAvailableModels };
export type { ProviderConfig };
