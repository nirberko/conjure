import type { Page } from '@playwright/test';

interface AgentStreamEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response' | 'error' | 'done';
  data: {
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: unknown;
    error?: string;
    artifacts?: unknown[];
    thinkingStatus?: 'start' | 'done';
    durationMs?: number;
  };
  timestamp: number;
}

interface AgentResult {
  events: AgentStreamEvent[];
  success: boolean;
  error?: string;
}

/**
 * Triggers the Conjure agent via chrome.runtime.sendMessage and collects
 * AGENT_STREAM_EVENT messages until 'done' or 'error'.
 *
 * Uses page.exposeFunction() to bridge events from the browser to Node.
 * Each browser-to-Node call is a short CDP round-trip, so the connection
 * survives even when the extension page is backgrounded by Chrome.
 *
 * Must be called from a page with chrome.runtime access (extension popup).
 */
export const triggerAgent = async (
  extensionPage: Page,
  extensionId: string,
  prompt: string,
  timeoutMs = 90_000,
): Promise<AgentResult> => {
  const events: AgentStreamEvent[] = [];
  const bridgeName = `__collectAgentEvent_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

  let settled = false;

  let resolve: (value: AgentResult) => void;
  let reject: (reason: Error) => void;
  const promise = new Promise<AgentResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const settle = (result: AgentResult | Error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    extensionPage.removeListener('close', onPageClose);
    if (result instanceof Error) {
      reject(result);
    } else {
      resolve(result);
    }
  };

  // Node-side timeout — survives page backgrounding
  const timeoutId = setTimeout(() => {
    settle(new Error(`Agent timed out after ${timeoutMs}ms. Collected ${events.length} events.`));
  }, timeoutMs);

  // Fail fast if the page is closed
  const onPageClose = () => {
    settle(new Error(`Extension page was closed before agent completed. Collected ${events.length} events.`));
  };
  extensionPage.on('close', onPageClose);

  // Expose a Node function that the browser listener will call for each event
  await extensionPage.exposeFunction(bridgeName, (event: AgentStreamEvent) => {
    events.push(event);

    if (event.type === 'done') {
      settle({ events, success: true });
    } else if (event.type === 'error') {
      settle({ events, success: false, error: event.data.error });
    }
  });

  // Short evaluate #1: register chrome.runtime.onMessage listener
  await extensionPage.evaluate(bridge => {
    const listener = (message: { type: string; payload: unknown }) => {
      if (message.type !== 'AGENT_STREAM_EVENT') return;
      const event = message.payload;

      // Call the exposed Node function
      const fn = (window as unknown as Record<string, unknown>)[bridge] as (event: unknown) => void;
      fn(event);

      // Self-remove on terminal events
      const eventType = (event as { type: string }).type;
      if (eventType === 'done' || eventType === 'error') {
        chrome.runtime.onMessage.removeListener(listener);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
  }, bridgeName);

  // Short evaluate #2: fire AGENT_RUN (fire-and-forget)
  await extensionPage.evaluate(
    ({ extensionId, prompt }) => {
      chrome.runtime.sendMessage({
        type: 'AGENT_RUN',
        payload: { extensionId, message: prompt },
      });
    },
    { extensionId, prompt },
  );

  return promise;
};
