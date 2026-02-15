import type { AIProvider, Artifact, TabInfo } from '../types/index.js';

export interface AgentRunConfig {
  extensionId: string;
  provider: AIProvider;
  apiKey: string;
  model: string;
  tabInfo?: TabInfo;
}

export interface AgentStreamEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response' | 'error' | 'done';
  data: {
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: unknown;
    error?: string;
    artifacts?: Artifact[];
    thinkingStatus?: 'start' | 'done';
    durationMs?: number;
  };
  timestamp: number;
}

export interface ToolContext {
  extensionId: string;
  tabId?: number;
  sendToContentScript: (tabId: number, message: unknown) => Promise<unknown>;
  waitForMessage: (messageType: string, timeoutMs?: number) => Promise<unknown>;
  sendToServiceWorker: (message: unknown) => Promise<unknown>;
}
