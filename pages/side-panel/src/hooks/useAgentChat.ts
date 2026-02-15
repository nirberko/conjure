import {
  getAgentConversation,
  addAgentMessage,
  updateLastAgentMessage,
  clearAgentConversation,
  REQUEST_USER_INPUT_TOOL_NAME,
} from '@extension/shared';
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Artifact,
  AgentChatMessage,
  ToolCallDisplay,
  ThinkingData,
  MessageDisplayItem,
  UserInputRequest,
} from '@extension/shared';

export type { ToolCallDisplay, ThinkingData, MessageDisplayItem } from '@extension/shared';
export type AgentMessage = AgentChatMessage;

export interface ActiveThinking {
  startTime: number;
}

export const useAgentChat = (extensionId: string) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeThinking, setActiveThinking] = useState<ActiveThinking | null>(null);
  const [pendingInputRequest, setPendingInputRequest] = useState<UserInputRequest | null>(null);
  const pendingToolCalls = useRef<ToolCallDisplay[]>([]);
  const pendingDisplayItems = useRef<MessageDisplayItem[]>([]);
  const pendingThinking = useRef<ThinkingData | null>(null);
  const messageIdCounter = useRef(0);

  // Load conversation history from DB on mount
  useEffect(() => {
    // Check if agent is still running in background
    chrome.runtime
      .sendMessage({ type: 'GET_AGENT_STATUS', payload: { extensionId } })
      .then((response: { isRunning?: boolean }) => {
        if (response?.isRunning) {
          setIsRunning(true);
          setActiveThinking({ startTime: Date.now() });
        }
      })
      .catch(err => console.error('[Conjure] Failed to query agent status:', err));

    getAgentConversation(extensionId)
      .then(conversation => {
        if (conversation && conversation.messages.length > 0) {
          // Resolve any pending tool calls to 'done' (they were in-flight when session ended)
          const restored: AgentMessage[] = conversation.messages.map(m => {
            const toolCalls = m.toolCalls?.map(tc => ({
              ...tc,
              status: tc.status === 'pending' ? ('done' as const) : tc.status,
            }));
            // Build displayItems from legacy fields if absent (backward compat)
            let displayItems = m.displayItems;
            if (!displayItems && (m.thinking || toolCalls?.length)) {
              displayItems = [];
              if (m.thinking) displayItems.push({ kind: 'thinking', data: m.thinking });
              if (toolCalls) {
                for (const tc of toolCalls) {
                  displayItems.push({ kind: 'tool_call', data: tc });
                }
              }
            }
            return { ...m, toolCalls, displayItems };
          });
          setMessages(restored);
          // Restore message ID counter to avoid collisions
          const maxId = conversation.messages.reduce((max, m) => {
            const num = parseInt(m.id.replace('msg-', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          messageIdCounter.current = maxId;
        }
      })
      .catch(err => console.error('[Conjure] Failed to load chat history:', err))
      .finally(() => setIsLoading(false));
  }, [extensionId]);

  useEffect(() => {
    const listener = (message: { type: string; payload?: unknown }) => {
      if (message.type !== 'AGENT_STREAM_EVENT') return;

      const event = message.payload as {
        type: string;
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
      };

      switch (event.type) {
        case 'thinking':
          if (event.data.thinkingStatus === 'start') {
            setActiveThinking({ startTime: Date.now() });
          } else if (event.data.thinkingStatus === 'done') {
            setActiveThinking(null);
            if (event.data.content) {
              const thinkingData: ThinkingData = {
                content: event.data.content,
                durationMs: event.data.durationMs ?? 0,
              };
              pendingThinking.current = thinkingData;
              pendingDisplayItems.current.push({ kind: 'thinking', data: thinkingData });

              // Immediately show the thinking block in the message bubble
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  // Append to existing assistant message (iteration 2+)
                  const updated = [...prev.slice(0, -1), { ...last, displayItems: [...pendingDisplayItems.current] }];
                  updateLastAgentMessage(extensionId, updated[updated.length - 1]).catch(err =>
                    console.error('[Conjure] Failed to persist thinking:', err),
                  );
                  return updated;
                }
                // Create new assistant message for iteration 1
                const thinking = pendingThinking.current ?? undefined;
                pendingThinking.current = null;
                const newMsg: AgentMessage = {
                  id: `msg-${++messageIdCounter.current}`,
                  role: 'assistant' as const,
                  content: '',
                  timestamp: event.timestamp,
                  thinking,
                  displayItems: [...pendingDisplayItems.current],
                };
                addAgentMessage(extensionId, newMsg).catch(err =>
                  console.error('[Conjure] Failed to persist thinking message:', err),
                );
                return [...prev, newMsg];
              });
            }
          }
          break;

        case 'tool_call': {
          // If this is a request_user_input call, show the form
          if (event.data.toolName === REQUEST_USER_INPUT_TOOL_NAME && event.data.toolArgs) {
            setPendingInputRequest(event.data.toolArgs as unknown as UserInputRequest);
          }
          const tc: ToolCallDisplay = {
            name: event.data.toolName ?? 'unknown',
            args: event.data.toolArgs ?? {},
            status: 'pending',
          };
          pendingToolCalls.current.push(tc);
          pendingDisplayItems.current.push({ kind: 'tool_call', data: tc });
          // Update the last assistant message with tool calls
          setMessages(prev => {
            const last = prev[prev.length - 1];
            let updated: AgentMessage[];
            if (last?.role === 'assistant') {
              updated = [
                ...prev.slice(0, -1),
                {
                  ...last,
                  toolCalls: [...pendingToolCalls.current],
                  displayItems: [...pendingDisplayItems.current],
                },
              ];
            } else {
              // New assistant message — attach pending thinking if available
              const thinking = pendingThinking.current ?? undefined;
              pendingThinking.current = null;
              updated = [
                ...prev,
                {
                  id: `msg-${++messageIdCounter.current}`,
                  role: 'assistant' as const,
                  content: '',
                  timestamp: event.timestamp,
                  toolCalls: [...pendingToolCalls.current],
                  displayItems: [...pendingDisplayItems.current],
                  thinking,
                },
              ];
            }
            // Persist the assistant message with tool calls
            const lastMsg = updated[updated.length - 1];
            if (lastMsg?.role === 'assistant') {
              if (last?.role === 'assistant') {
                updateLastAgentMessage(extensionId, lastMsg).catch(err =>
                  console.error('[Conjure] Failed to persist tool_call:', err),
                );
              } else {
                addAgentMessage(extensionId, lastMsg).catch(err =>
                  console.error('[Conjure] Failed to persist new assistant message:', err),
                );
              }
            }
            return updated;
          });
          break;
        }

        case 'tool_result': {
          if (event.data.toolName === REQUEST_USER_INPUT_TOOL_NAME) {
            setPendingInputRequest(null);
          }
          const tcRef = pendingToolCalls.current.find(t => t.name === event.data.toolName && t.status === 'pending');
          if (tcRef) {
            // Mutate in place — same object is in both pendingToolCalls and pendingDisplayItems
            tcRef.status = 'done';
            tcRef.result =
              typeof event.data.toolResult === 'string' ? event.data.toolResult : JSON.stringify(event.data.toolResult);
          }
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              const updated = [
                ...prev.slice(0, -1),
                {
                  ...last,
                  toolCalls: [...pendingToolCalls.current],
                  displayItems: [...pendingDisplayItems.current],
                },
              ];
              // Persist the updated tool result
              const lastMsg = updated[updated.length - 1];
              updateLastAgentMessage(extensionId, lastMsg).catch(err =>
                console.error('[Conjure] Failed to persist tool_result:', err),
              );
              return updated;
            }
            return prev;
          });
          break;
        }

        case 'response': {
          pendingToolCalls.current = [];
          const thinking = pendingThinking.current ?? undefined;
          pendingThinking.current = null;
          const responseDisplayItems =
            pendingDisplayItems.current.length > 0 ? [...pendingDisplayItems.current] : undefined;
          pendingDisplayItems.current = [];

          setMessages(prev => {
            const last = prev[prev.length - 1];
            // If last message is an empty assistant message (created by thinking:done, no tool calls),
            // merge the response content into it instead of creating a duplicate
            if (last?.role === 'assistant' && !last.content && (!last.toolCalls || last.toolCalls.length === 0)) {
              const merged: AgentMessage = {
                ...last,
                content: event.data.content ?? '',
                thinking: last.thinking ?? thinking,
                displayItems: responseDisplayItems ?? last.displayItems,
              };
              const updated = [...prev.slice(0, -1), merged];
              updateLastAgentMessage(extensionId, merged).catch(err =>
                console.error('[Conjure] Failed to persist response:', err),
              );
              return updated;
            }
            // Create new response message (normal case: after tool calls)
            const responseMsg: AgentMessage = {
              id: `msg-${++messageIdCounter.current}`,
              role: 'assistant',
              content: event.data.content ?? '',
              timestamp: event.timestamp,
              thinking,
              displayItems: responseDisplayItems,
            };
            addAgentMessage(extensionId, responseMsg).catch(err =>
              console.error('[Conjure] Failed to persist response:', err),
            );
            return [...prev, responseMsg];
          });
          break;
        }

        case 'error': {
          pendingToolCalls.current = [];
          pendingDisplayItems.current = [];
          pendingThinking.current = null;
          setActiveThinking(null);
          setPendingInputRequest(null);
          const errorMsg: AgentMessage = {
            id: `msg-${++messageIdCounter.current}`,
            role: 'assistant',
            content: `Error: ${event.data.error}`,
            timestamp: event.timestamp,
          };
          setMessages(prev => [...prev, errorMsg]);
          setIsRunning(false);
          // Persist the error message
          addAgentMessage(extensionId, errorMsg).catch(err => console.error('[Conjure] Failed to persist error:', err));
          break;
        }

        case 'done':
          setPendingInputRequest(null);
          // Resolve any still-pending tool calls to 'skipped' so they don't show as perpetually loading
          if (pendingToolCalls.current.some(tc => tc.status === 'pending')) {
            for (const tc of pendingToolCalls.current) {
              if (tc.status === 'pending') {
                tc.status = 'skipped';
              }
            }
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                const updated = [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    toolCalls: [...pendingToolCalls.current],
                    displayItems: [...pendingDisplayItems.current],
                  },
                ];
                updateLastAgentMessage(extensionId, updated[updated.length - 1]).catch(err =>
                  console.error('[Conjure] Failed to persist skipped tool calls:', err),
                );
                return updated;
              }
              return prev;
            });
          }
          pendingToolCalls.current = [];
          pendingDisplayItems.current = [];
          pendingThinking.current = null;
          setActiveThinking(null);
          if (event.data.artifacts) {
            setArtifacts(event.data.artifacts);
          }
          setIsRunning(false);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [extensionId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isRunning) return;

      const userMsg: AgentMessage = {
        id: `msg-${++messageIdCounter.current}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      setIsRunning(true);
      pendingToolCalls.current = [];
      pendingDisplayItems.current = [];

      // Persist user message
      addAgentMessage(extensionId, userMsg).catch(err =>
        console.error('[Conjure] Failed to persist user message:', err),
      );

      chrome.runtime
        .sendMessage({
          type: 'AGENT_RUN',
          payload: { extensionId, message: content },
        })
        .catch(err => console.error('[Conjure] Failed to send AGENT_RUN:', err));
    },
    [extensionId, isRunning],
  );

  const stopAgent = useCallback(() => {
    chrome.runtime.sendMessage({
      type: 'AGENT_STOP',
      payload: { extensionId },
    });
    setIsRunning(false);
    setActiveThinking(null);
    pendingThinking.current = null;
    pendingToolCalls.current = [];
    pendingDisplayItems.current = [];
  }, [extensionId]);

  const submitUserInput = useCallback((values: Record<string, string | number>) => {
    chrome.runtime
      .sendMessage({ type: 'USER_INPUT_RESULT', payload: values })
      .catch(err => console.error('[Conjure] Failed to send USER_INPUT_RESULT:', err));
    setPendingInputRequest(null);
  }, []);

  const cancelUserInput = useCallback(() => {
    chrome.runtime
      .sendMessage({ type: 'USER_INPUT_RESULT', payload: null })
      .catch(err => console.error('[Conjure] Failed to send USER_INPUT_RESULT cancel:', err));
    setPendingInputRequest(null);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    pendingToolCalls.current = [];
    pendingDisplayItems.current = [];
    setIsRunning(false);
    clearAgentConversation(extensionId).catch(err => console.error('[Conjure] Failed to clear conversation:', err));
  }, [extensionId]);

  return {
    messages,
    isRunning,
    isLoading,
    artifacts,
    activeThinking,
    pendingInputRequest,
    sendMessage,
    stopAgent,
    clearChat,
    submitUserInput,
    cancelUserInput,
  };
};
