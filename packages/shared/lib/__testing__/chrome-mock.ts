import { vi } from 'vitest';

type MessageListener = (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => void;

export function createChromeMock() {
  const messageListeners: MessageListener[] = [];

  const mock = {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: {
        addListener: vi.fn((cb: MessageListener) => {
          messageListeners.push(cb);
        }),
        removeListener: vi.fn((cb: MessageListener) => {
          const idx = messageListeners.indexOf(cb);
          if (idx >= 0) messageListeners.splice(idx, 1);
        }),
        hasListener: vi.fn((cb: MessageListener) => messageListeners.includes(cb)),
      },
      getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
      getContexts: vi.fn().mockResolvedValue([]),
      ContextType: { OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT' },
      id: 'mock-extension-id',
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([{ result: undefined }]),
      insertCSS: vi.fn().mockResolvedValue(undefined),
      removeCSS: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      sync: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    offscreen: {
      createDocument: vi.fn().mockResolvedValue(undefined),
      closeDocument: vi.fn().mockResolvedValue(undefined),
      hasDocument: vi.fn().mockResolvedValue(false),
      Reason: { DOM_PARSER: 'DOM_PARSER', WORKERS: 'WORKERS' },
    },
    sidePanel: {
      setOptions: vi.fn().mockResolvedValue(undefined),
      setPanelBehavior: vi.fn().mockResolvedValue(undefined),
    },
    _messageListeners: messageListeners,
    _simulateMessage(message: unknown, sender?: unknown) {
      for (const listener of messageListeners) {
        listener(message, sender ?? { id: 'mock-extension-id' }, vi.fn());
      }
    },
  };

  return mock;
}
