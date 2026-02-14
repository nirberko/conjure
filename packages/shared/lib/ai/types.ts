import type { ChatMessage } from '../types/index.js';

export interface LegacyAIProvider {
  chat(messages: ChatMessage[], systemPrompt: string): AsyncGenerator<string>;
}

export interface AIGenerationContext {
  cssSelector: string;
  pageUrl: string;
  existingCode?: string;
}
