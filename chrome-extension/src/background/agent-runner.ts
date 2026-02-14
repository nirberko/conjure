import { startBackgroundWorker, stopBackgroundWorker, reloadBackgroundWorker } from './worker-manager.js';
import { getArtifactsByExtension, getSetting } from '@extension/shared';
import { buildAgentGraph, createUserMessage, DexieCheckpointSaver, createChatModel } from '@extension/shared/agent';
import type { AIProvider, TabInfo } from '@extension/shared';
import type { ToolContext, AgentStreamEvent } from '@extension/shared/agent';

export type { AgentStreamEvent } from '@extension/shared/agent';

export interface AgentRunConfig {
  extensionId: string;
  provider: AIProvider;
  apiKey: string;
  model: string;
  tabInfo?: TabInfo;
}

const activeRuns = new Map<string, AbortController>();
const checkpointer = new DexieCheckpointSaver();

function sendStreamEvent(event: AgentStreamEvent) {
  console.log('[WebForge Agent] Stream event:', event.type, event.data);
  chrome.runtime.sendMessage({ type: 'AGENT_STREAM_EVENT', payload: event }).catch(err => {
    console.warn('[WebForge Agent] Failed to send stream event:', err.message);
  });
}

function createToolContext(config: AgentRunConfig): ToolContext {
  return {
    extensionId: config.extensionId,
    tabId: config.tabInfo?.tabId,
    sendToContentScript: (tabId: number, message: unknown) =>
      new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      }),
    waitForMessage: (messageType: string, timeoutMs = 30000) =>
      new Promise((resolve, reject) => {
        let settled = false;

        const listener = (message: { type: string; payload?: unknown }) => {
          if (message.type === messageType) {
            if (settled) return;
            settled = true;
            chrome.runtime.onMessage.removeListener(listener);
            clearTimeout(timer);
            resolve(message.payload);
          }
        };

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          chrome.runtime.onMessage.removeListener(listener);
          reject(new Error(`Timed out waiting for message: ${messageType}`));
        }, timeoutMs);

        chrome.runtime.onMessage.addListener(listener);
      }),
    sendToServiceWorker: async (message: unknown) => {
      // We're already in the service worker, so handle messages directly
      const msg = message as { type: string; payload?: Record<string, unknown> };

      switch (msg.type) {
        case 'START_BACKGROUND_WORKER':
          return startBackgroundWorker(msg.payload?.artifactId as string);
        case 'STOP_BACKGROUND_WORKER':
          return stopBackgroundWorker(msg.payload?.extensionId as string);
        case 'RELOAD_BACKGROUND_WORKER':
          return reloadBackgroundWorker(msg.payload?.artifactId as string);
        default:
          return { error: `Unknown service worker message type: ${msg.type}` };
      }
    },
  };
}

export async function runAgent(config: AgentRunConfig, userMessage: string): Promise<void> {
  console.log('[WebForge Agent] runAgent called:', {
    provider: config.provider,
    model: config.model,
    extensionId: config.extensionId,
  });

  const existing = activeRuns.get(config.extensionId);
  if (existing) {
    console.log('[WebForge Agent] Aborting existing run for', config.extensionId);
    existing.abort();
  }

  const abortController = new AbortController();
  activeRuns.set(config.extensionId, abortController);

  try {
    console.log('[WebForge Agent] Creating chat model...');
    const model = createChatModel({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
    console.log('[WebForge Agent] Model created');

    const toolContext = createToolContext(config);
    const graph = buildAgentGraph(model, toolContext);
    console.log('[WebForge Agent] Graph built, compiling...');
    const compiledGraph = graph.compile({ checkpointer });
    console.log('[WebForge Agent] Graph compiled');

    const threadConfig = {
      configurable: {
        thread_id: config.extensionId,
        checkpoint_ns: '',
      },
    };

    // Emit initial thinking start (planner is the first node)
    let thinkingStartTime = Date.now();
    sendStreamEvent({
      type: 'thinking',
      data: { thinkingStatus: 'start' },
      timestamp: Date.now(),
    });

    const recursionLimit = (await getSetting<number>('agent_recursion_limit')) ?? 50;
    console.log('[WebForge Agent] Starting stream (recursionLimit:', recursionLimit, ')...');
    const stream = await compiledGraph.stream(
      {
        messages: [createUserMessage(userMessage)],
        extensionId: config.extensionId,
        activeTabInfo: config.tabInfo ?? null,
      },
      {
        ...threadConfig,
        streamMode: 'updates',
        signal: abortController.signal,
        recursionLimit,
      },
    );
    console.log('[WebForge Agent] Stream started, iterating events...');

    let hasUnresolvedToolCall = false;
    let lastToolCallName = '';

    for await (const event of stream) {
      console.log('[WebForge Agent] Stream event received:', JSON.stringify(event).slice(0, 500));
      if (abortController.signal.aborted) break;

      for (const [nodeName, output] of Object.entries(event)) {
        const nodeOutput = output as Record<string, unknown>;

        // Handle planner node output — emit thinking done
        if (nodeName === 'planner') {
          const planContent = (nodeOutput.plan as string) ?? '';
          const durationMs = Date.now() - thinkingStartTime;
          sendStreamEvent({
            type: 'thinking',
            data: { thinkingStatus: 'done', content: planContent, durationMs },
            timestamp: Date.now(),
          });
          continue;
        }

        // After tool_executor output, planner runs next — emit thinking start
        if (nodeName === 'tool_executor') {
          thinkingStartTime = Date.now();
          sendStreamEvent({
            type: 'thinking',
            data: { thinkingStatus: 'start' },
            timestamp: Date.now(),
          });
        }

        const messages = (nodeOutput.messages ?? []) as Array<Record<string, unknown>>;

        for (const msg of messages) {
          if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
            for (const toolCall of msg.tool_calls as Array<{ name: string; args: Record<string, unknown> }>) {
              hasUnresolvedToolCall = true;
              lastToolCallName = toolCall.name;
              sendStreamEvent({
                type: 'tool_call',
                data: {
                  toolName: toolCall.name,
                  toolArgs: toolCall.args,
                },
                timestamp: Date.now(),
              });
            }
          }

          if (msg.role === 'tool') {
            hasUnresolvedToolCall = false;
            sendStreamEvent({
              type: 'tool_result',
              data: {
                toolName: msg.name as string,
                toolResult: msg.content,
              },
              timestamp: Date.now(),
            });
          }

          if (msg.content && nodeName === 'orchestrator') {
            const hasToolCalls = msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
            if (!hasToolCalls) {
              sendStreamEvent({
                type: 'response',
                data: { content: typeof msg.content === 'string' ? msg.content : '' },
                timestamp: Date.now(),
              });
            }
          }
        }
      }
    }

    // If the stream ended with an unresolved tool call (e.g. recursion limit hit),
    // emit a response so the UI doesn't show a permanently pending tool call.
    if (hasUnresolvedToolCall) {
      console.warn('[WebForge Agent] Stream ended with unresolved tool call:', lastToolCallName);
      sendStreamEvent({
        type: 'response',
        data: {
          content: `I reached the maximum iteration limit while trying to execute the "${lastToolCallName}" tool. You can try again or increase the recursion limit in settings.`,
        },
        timestamp: Date.now(),
      });
    }

    const artifacts = await getArtifactsByExtension(config.extensionId);
    sendStreamEvent({
      type: 'done',
      data: { artifacts },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[WebForge Agent] Error:', error);
    if (abortController.signal.aborted) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    sendStreamEvent({
      type: 'error',
      data: { error: errorMessage },
      timestamp: Date.now(),
    });
  } finally {
    activeRuns.delete(config.extensionId);
  }
}

export function getAgentStatus(extensionId: string): boolean {
  return activeRuns.has(extensionId);
}

export function stopAgent(extensionId: string): boolean {
  const controller = activeRuns.get(extensionId);
  if (controller) {
    controller.abort();
    activeRuns.delete(extensionId);
    return true;
  }
  return false;
}
