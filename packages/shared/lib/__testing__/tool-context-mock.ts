import { vi } from 'vitest';
import type { ToolContext } from '../agent/types.js';

export function createMockToolContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    extensionId: 'test-extension-id',
    tabId: 123,
    sendToContentScript: vi.fn().mockResolvedValue(undefined),
    waitForMessage: vi.fn().mockResolvedValue(undefined),
    sendToServiceWorker: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
