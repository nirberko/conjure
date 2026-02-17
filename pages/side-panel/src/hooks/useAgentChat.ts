import {
  getAgentConversation,
  addAgentMessage,
  updateLastAgentMessage,
  clearAgentConversation,
  REQUEST_USER_INPUT_TOOL_NAME,
} from '@extension/shared';
import { useReducer, useCallback, useEffect, useRef } from 'react';
import type {
  Artifact,
  AgentChatMessage,
  ToolCallDisplay,
  ThinkingData,
  MessageDisplayItem,
  UserInputRequest,
} from '@extension/shared';

interface ActiveThinking {
  startTime: number;
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface Turn {
  toolCalls: ToolCallDisplay[];
  displayItems: MessageDisplayItem[];
  thinking: ThinkingData | null;
}

// ---------------------------------------------------------------------------
// Persistence operations (side-effects collected by reducer)
// ---------------------------------------------------------------------------

type PersistenceOp =
  | { op: 'add'; message: AgentChatMessage }
  | { op: 'update'; message: AgentChatMessage }
  | { op: 'clear' };

interface ChatState {
  messages: AgentChatMessage[];
  isRunning: boolean;
  isLoading: boolean;
  artifacts: Artifact[];
  activeThinking: ActiveThinking | null;
  pendingInputRequest: UserInputRequest | null;
  turn: Turn;
  nextMsgId: number;
  _pendingOps: PersistenceOp[];
}

const emptyTurn = (): Turn => ({ toolCalls: [], displayItems: [], thinking: null });

const initialState: ChatState = {
  messages: [],
  isRunning: false,
  isLoading: true,
  artifacts: [],
  activeThinking: null,
  pendingInputRequest: null,
  turn: emptyTurn(),
  nextMsgId: 0,
  _pendingOps: [],
};

type ChatAction =
  | { type: 'LOADED'; messages: AgentChatMessage[]; maxId: number }
  | { type: 'AGENT_STATUS'; isRunning: boolean }
  | { type: 'SEND_MESSAGE'; content: string; timestamp: number }
  | { type: 'STREAM_THINKING_START' }
  | { type: 'STREAM_THINKING_DONE'; content: string; durationMs: number; timestamp: number }
  | { type: 'STREAM_TOOL_CALL'; toolName: string; toolArgs: Record<string, unknown>; timestamp: number }
  | { type: 'STREAM_TOOL_RESULT'; toolName: string; toolResult: string }
  | { type: 'STREAM_RESPONSE'; content: string; timestamp: number }
  | { type: 'STREAM_ERROR'; error: string; timestamp: number }
  | { type: 'STREAM_DONE'; artifacts?: Artifact[] }
  | { type: 'STOP' }
  | { type: 'CLEAR' }
  | { type: 'DISMISS_INPUT_REQUEST' }
  | { type: 'DRAIN_OPS' };

// ---------------------------------------------------------------------------
// Reducer helpers
// ---------------------------------------------------------------------------

type ReducerResult = [ChatState, PersistenceOp[]];

/** Returns the last assistant message for update, or creates a new one. */
const ensureAssistantMessage = (
  state: ChatState,
  timestamp: number,
): { messages: AgentChatMessage[]; assistant: AgentChatMessage; isNew: boolean } => {
  const last = state.messages[state.messages.length - 1];
  if (last?.role === 'assistant') {
    return { messages: state.messages, assistant: last, isNew: false };
  }
  const newMsg: AgentChatMessage = {
    id: `msg-${state.nextMsgId + 1}`,
    role: 'assistant',
    content: '',
    timestamp,
  };
  return { messages: [...state.messages, newMsg], assistant: newMsg, isNew: true };
};

const replaceLastMessage = (messages: AgentChatMessage[], updated: AgentChatMessage): AgentChatMessage[] => [
  ...messages.slice(0, -1),
  updated,
];

// ---------------------------------------------------------------------------
// Core reducer (pure — returns [state, ops])
// ---------------------------------------------------------------------------

const chatReducerWithEffects = (state: ChatState, action: ChatAction): ReducerResult => {
  switch (action.type) {
    case 'LOADED': {
      return [
        {
          ...state,
          messages: action.messages,
          nextMsgId: action.maxId,
          isLoading: false,
        },
        [],
      ];
    }

    case 'AGENT_STATUS': {
      return [
        {
          ...state,
          isRunning: action.isRunning,
          activeThinking: action.isRunning ? { startTime: Date.now() } : null,
        },
        [],
      ];
    }

    case 'SEND_MESSAGE': {
      const userMsg: AgentChatMessage = {
        id: `msg-${state.nextMsgId + 1}`,
        role: 'user',
        content: action.content,
        timestamp: action.timestamp,
      };
      return [
        {
          ...state,
          messages: [...state.messages, userMsg],
          isRunning: true,
          turn: emptyTurn(),
          nextMsgId: state.nextMsgId + 1,
        },
        [{ op: 'add', message: userMsg }],
      ];
    }

    case 'STREAM_THINKING_START': {
      return [{ ...state, activeThinking: { startTime: Date.now() } }, []];
    }

    case 'STREAM_THINKING_DONE': {
      const thinkingData: ThinkingData = {
        content: action.content,
        durationMs: action.durationMs,
      };
      const newTurn: Turn = {
        ...state.turn,
        thinking: thinkingData,
        displayItems: [...state.turn.displayItems, { kind: 'thinking', data: thinkingData }],
      };

      const { messages, assistant, isNew } = ensureAssistantMessage(state, action.timestamp);
      const nextId = isNew ? state.nextMsgId + 1 : state.nextMsgId;

      const updated: AgentChatMessage = {
        ...assistant,
        thinking: assistant.thinking ?? thinkingData,
        displayItems: [...newTurn.displayItems],
      };

      return [
        {
          ...state,
          messages: isNew ? replaceLastMessage(messages, updated) : replaceLastMessage(state.messages, updated),
          activeThinking: null,
          turn: newTurn,
          nextMsgId: nextId,
        },
        [isNew ? { op: 'add', message: updated } : { op: 'update', message: updated }],
      ];
    }

    case 'STREAM_TOOL_CALL': {
      const tc: ToolCallDisplay = {
        name: action.toolName,
        args: action.toolArgs,
        status: 'pending',
      };
      const newTurn: Turn = {
        ...state.turn,
        toolCalls: [...state.turn.toolCalls, tc],
        displayItems: [...state.turn.displayItems, { kind: 'tool_call', data: tc }],
      };

      // Handle user input request
      let pendingInputRequest = state.pendingInputRequest;
      if (action.toolName === REQUEST_USER_INPUT_TOOL_NAME && action.toolArgs) {
        pendingInputRequest = action.toolArgs as unknown as UserInputRequest;
      }

      const { messages, assistant, isNew } = ensureAssistantMessage(state, action.timestamp);
      const nextId = isNew ? state.nextMsgId + 1 : state.nextMsgId;

      const thinking = isNew ? (state.turn.thinking ?? undefined) : assistant.thinking;
      const updated: AgentChatMessage = {
        ...assistant,
        thinking,
        toolCalls: [...newTurn.toolCalls],
        displayItems: [...newTurn.displayItems],
      };

      return [
        {
          ...state,
          messages: isNew ? replaceLastMessage(messages, updated) : replaceLastMessage(state.messages, updated),
          turn: newTurn,
          nextMsgId: nextId,
          pendingInputRequest,
        },
        [isNew ? { op: 'add', message: updated } : { op: 'update', message: updated }],
      ];
    }

    case 'STREAM_TOOL_RESULT': {
      // Mark only the FIRST pending tool call with matching name as done
      let foundTc = false;
      const updatedToolCalls = state.turn.toolCalls.map(tc => {
        if (!foundTc && tc.name === action.toolName && tc.status === 'pending') {
          foundTc = true;
          return { ...tc, status: 'done' as const, result: action.toolResult };
        }
        return tc;
      });
      // Also update the first matching in displayItems
      let foundDi = false;
      const updatedDisplayItems = state.turn.displayItems.map(item => {
        if (
          !foundDi &&
          item.kind === 'tool_call' &&
          item.data.name === action.toolName &&
          item.data.status === 'pending'
        ) {
          foundDi = true;
          return { ...item, data: { ...item.data, status: 'done' as const, result: action.toolResult } };
        }
        return item;
      });
      const newTurn: Turn = { ...state.turn, toolCalls: updatedToolCalls, displayItems: updatedDisplayItems };

      let pendingInputRequest = state.pendingInputRequest;
      if (action.toolName === REQUEST_USER_INPUT_TOOL_NAME) {
        pendingInputRequest = null;
      }

      const last = state.messages[state.messages.length - 1];
      if (last?.role === 'assistant') {
        const updated: AgentChatMessage = {
          ...last,
          toolCalls: [...updatedToolCalls],
          displayItems: [...updatedDisplayItems],
        };
        return [
          {
            ...state,
            messages: replaceLastMessage(state.messages, updated),
            turn: newTurn,
            pendingInputRequest,
          },
          [{ op: 'update', message: updated }],
        ];
      }
      return [{ ...state, turn: newTurn, pendingInputRequest }, []];
    }

    case 'STREAM_RESPONSE': {
      const newTurn = emptyTurn();

      const last = state.messages[state.messages.length - 1];
      // Merge into existing assistant message if it has no content yet (created by thinking_done)
      if (last?.role === 'assistant' && !last.content && (!last.toolCalls || last.toolCalls.length === 0)) {
        const displayItems = state.turn.displayItems.length > 0 ? [...state.turn.displayItems] : last.displayItems;
        const merged: AgentChatMessage = {
          ...last,
          content: action.content,
          thinking: last.thinking ?? state.turn.thinking ?? undefined,
          displayItems,
        };
        return [
          { ...state, messages: replaceLastMessage(state.messages, merged), turn: newTurn },
          [{ op: 'update', message: merged }],
        ];
      }

      // Create new response message (normal case: after tool calls).
      // Don't copy turn displayItems/thinking — they're already in the previous assistant message.
      const responseMsg: AgentChatMessage = {
        id: `msg-${state.nextMsgId + 1}`,
        role: 'assistant',
        content: action.content,
        timestamp: action.timestamp,
      };
      return [
        {
          ...state,
          messages: [...state.messages, responseMsg],
          turn: newTurn,
          nextMsgId: state.nextMsgId + 1,
        },
        [{ op: 'add', message: responseMsg }],
      ];
    }

    case 'STREAM_ERROR': {
      const errorMsg: AgentChatMessage = {
        id: `msg-${state.nextMsgId + 1}`,
        role: 'assistant',
        content: `Error: ${action.error}`,
        timestamp: action.timestamp,
      };
      return [
        {
          ...state,
          messages: [...state.messages, errorMsg],
          isRunning: false,
          activeThinking: null,
          pendingInputRequest: null,
          turn: emptyTurn(),
          nextMsgId: state.nextMsgId + 1,
        },
        [{ op: 'add', message: errorMsg }],
      ];
    }

    case 'STREAM_DONE': {
      // Resolve any still-pending tool calls to 'skipped'
      const hasPending = state.turn.toolCalls.some(tc => tc.status === 'pending');
      let ops: PersistenceOp[] = [];

      let messages = state.messages;
      if (hasPending) {
        const resolvedToolCalls = state.turn.toolCalls.map(tc =>
          tc.status === 'pending' ? { ...tc, status: 'skipped' as const } : tc,
        );
        const resolvedDisplayItems = state.turn.displayItems.map(item =>
          item.kind === 'tool_call' && item.data.status === 'pending'
            ? { ...item, data: { ...item.data, status: 'skipped' as const } }
            : item,
        );
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
          const updated: AgentChatMessage = {
            ...last,
            toolCalls: resolvedToolCalls,
            displayItems: resolvedDisplayItems,
          };
          messages = replaceLastMessage(messages, updated);
          ops = [{ op: 'update', message: updated }];
        }
      }

      return [
        {
          ...state,
          messages,
          isRunning: false,
          activeThinking: null,
          pendingInputRequest: null,
          turn: emptyTurn(),
          artifacts: action.artifacts ?? state.artifacts,
        },
        ops,
      ];
    }

    case 'STOP': {
      return [
        {
          ...state,
          isRunning: false,
          activeThinking: null,
          turn: emptyTurn(),
        },
        [],
      ];
    }

    case 'DISMISS_INPUT_REQUEST': {
      return [{ ...state, pendingInputRequest: null }, []];
    }

    case 'CLEAR': {
      return [
        {
          ...initialState,
          isLoading: false,
        },
        [{ op: 'clear' }],
      ];
    }

    case 'DRAIN_OPS': {
      return [{ ...state, _pendingOps: [] }, []];
    }
  }
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  const [newState, ops] = chatReducerWithEffects(state, action);
  // LOADED replaces all state for a (possibly new) extension — discard stale ops
  if (action.type === 'LOADED') {
    return { ...newState, _pendingOps: [] };
  }
  return { ...newState, _pendingOps: [...newState._pendingOps, ...ops] };
};

export const useAgentChat = (extensionId: string) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Track the extensionId that pending ops belong to, updated only in effects.
  const opsExtensionIdRef = useRef(extensionId);

  // --- Drain persistence effects after each render ---
  useEffect(() => {
    if (state._pendingOps.length === 0) {
      opsExtensionIdRef.current = extensionId;
      return;
    }
    const ops = state._pendingOps;
    dispatch({ type: 'DRAIN_OPS' });

    // If extensionId changed since ops were queued, discard them
    if (opsExtensionIdRef.current !== extensionId) {
      opsExtensionIdRef.current = extensionId;
      return;
    }

    for (const op of ops) {
      switch (op.op) {
        case 'add':
          addAgentMessage(extensionId, op.message).catch(err => console.error('[Conjure] Failed to persist add:', err));
          break;
        case 'update':
          updateLastAgentMessage(extensionId, op.message).catch(err =>
            console.error('[Conjure] Failed to persist update:', err),
          );
          break;
        case 'clear':
          clearAgentConversation(extensionId).catch(err =>
            console.error('[Conjure] Failed to clear conversation:', err),
          );
          break;
      }
    }
  }, [state._pendingOps, extensionId]);

  // --- Load conversation from DB + check agent status ---
  useEffect(() => {
    let cancelled = false;

    chrome.runtime
      .sendMessage({ type: 'GET_AGENT_STATUS', payload: { extensionId } })
      .then((response: { isRunning?: boolean }) => {
        if (!cancelled) {
          dispatch({ type: 'AGENT_STATUS', isRunning: !!response?.isRunning });
        }
      })
      .catch(err => console.error('[Conjure] Failed to query agent status:', err));

    getAgentConversation(extensionId)
      .then(conversation => {
        if (cancelled) return;
        if (conversation && conversation.messages.length > 0) {
          // Resolve any pending tool calls to 'done' (they were in-flight when session ended)
          const restored: AgentChatMessage[] = conversation.messages.map(m => {
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
          const maxId = conversation.messages.reduce((max, m) => {
            const num = parseInt(m.id.replace('msg-', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          dispatch({ type: 'LOADED', messages: restored, maxId });
        } else {
          dispatch({ type: 'LOADED', messages: [], maxId: 0 });
        }
      })
      .catch(err => {
        console.error('[Conjure] Failed to load chat history:', err);
        if (!cancelled) {
          dispatch({ type: 'LOADED', messages: [], maxId: 0 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [extensionId]);

  // --- Listen for stream events from background ---
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
            dispatch({ type: 'STREAM_THINKING_START' });
          } else if (event.data.thinkingStatus === 'done' && event.data.content) {
            dispatch({
              type: 'STREAM_THINKING_DONE',
              content: event.data.content,
              durationMs: event.data.durationMs ?? 0,
              timestamp: event.timestamp,
            });
          }
          break;

        case 'tool_call':
          dispatch({
            type: 'STREAM_TOOL_CALL',
            toolName: event.data.toolName ?? 'unknown',
            toolArgs: event.data.toolArgs ?? {},
            timestamp: event.timestamp,
          });
          break;

        case 'tool_result':
          {
            let toolResult: string;
            if (typeof event.data.toolResult === 'string') {
              toolResult = event.data.toolResult;
            } else {
              try {
                toolResult = JSON.stringify(event.data.toolResult);
              } catch {
                toolResult = String(event.data.toolResult);
              }
            }
            dispatch({
              type: 'STREAM_TOOL_RESULT',
              toolName: event.data.toolName ?? 'unknown',
              toolResult,
            });
          }
          break;

        case 'response':
          dispatch({
            type: 'STREAM_RESPONSE',
            content: event.data.content ?? '',
            timestamp: event.timestamp,
          });
          break;

        case 'error':
          dispatch({
            type: 'STREAM_ERROR',
            error: event.data.error ?? 'Unknown error',
            timestamp: event.timestamp,
          });
          break;

        case 'done':
          dispatch({
            type: 'STREAM_DONE',
            artifacts: event.data.artifacts,
          });
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [extensionId]);

  // --- Actions ---

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || state.isRunning) return;
      dispatch({ type: 'SEND_MESSAGE', content, timestamp: Date.now() });

      chrome.runtime
        .sendMessage({
          type: 'AGENT_RUN',
          payload: { extensionId, message: content },
        })
        .catch(err => console.error('[Conjure] Failed to send AGENT_RUN:', err));
    },
    [extensionId, state.isRunning],
  );

  const stopAgent = useCallback(() => {
    chrome.runtime.sendMessage({
      type: 'AGENT_STOP',
      payload: { extensionId },
    });
    dispatch({ type: 'STOP' });
  }, [extensionId]);

  const clearChat = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const submitUserInput = useCallback((values: Record<string, string | number>) => {
    chrome.runtime
      .sendMessage({ type: 'USER_INPUT_RESULT', payload: values })
      .catch(err => console.error('[Conjure] Failed to send USER_INPUT_RESULT:', err));
    dispatch({ type: 'DISMISS_INPUT_REQUEST' });
  }, []);

  const cancelUserInput = useCallback(() => {
    chrome.runtime
      .sendMessage({ type: 'USER_INPUT_RESULT', payload: null })
      .catch(err => console.error('[Conjure] Failed to send USER_INPUT_RESULT cancel:', err));
    dispatch({ type: 'DISMISS_INPUT_REQUEST' });
  }, []);

  return {
    messages: state.messages,
    isRunning: state.isRunning,
    isLoading: state.isLoading,
    artifacts: state.artifacts,
    activeThinking: state.activeThinking,
    pendingInputRequest: state.pendingInputRequest,
    sendMessage,
    stopAgent,
    clearChat,
    submitUserInput,
    cancelUserInput,
  };
};

export type { ToolCallDisplay, ThinkingData, MessageDisplayItem } from '@extension/shared';
export type AgentMessage = AgentChatMessage;
export type { ActiveThinking };
