import { AgentThinking } from './AgentThinking';
import { CodeBlock } from './CodeBlock';
import { MarkdownContent } from './MarkdownContent';
import { ThinkingBlock } from './ThinkingBlock';
import { UserInputForm } from './UserInputForm';
import { useAgentChat } from '../hooks/useAgentChat';
import { getToolMetadata } from '../utils/tool-metadata';
import { t } from '@extension/i18n';
import { useState, useRef, useEffect } from 'react';
import type { AgentMessage, ToolCallDisplay } from '../hooks/useAgentChat';

interface AgentChatPanelProps {
  extensionId: string;
}

/** Relative time e.g. "2 hours ago", "a few seconds ago" */
const formatRelativeTime = (ms: number): string => {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 10) return t('chatTimeFewSecondsAgo');
  if (sec < 60) return t('chatTimeSecondsAgo', String(sec));
  const min = Math.floor(sec / 60);
  if (min === 1) return t('chatTimeOneMinuteAgo');
  if (min < 60) return t('chatTimeMinutesAgo', String(min));
  const hr = Math.floor(min / 60);
  if (hr === 1) return t('chatTimeOneHourAgo');
  if (hr < 24) return t('chatTimeHoursAgo', String(hr));
  const d = Math.floor(hr / 24);
  if (d === 1) return t('chatTimeOneDayAgo');
  return t('chatTimeDaysAgo', String(d));
};

const ToolCallBlock = ({ toolCall }: { toolCall: ToolCallDisplay }) => {
  const [expanded, setExpanded] = useState(false);
  const toolMeta = getToolMetadata(toolCall.name);

  const statusIcon =
    toolCall.status === 'pending' ? (
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
    ) : toolCall.status === 'error' ? (
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
    ) : toolCall.status === 'skipped' ? (
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
    ) : (
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
    );

  const formatResult = (result: string) => {
    try {
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return result;
    }
  };

  const hasDetails = Object.entries(toolCall.args).length > 0 || (toolCall.result != null && toolCall.result !== '');

  return (
    <div className="space-y-2">
      {/* Header: always visible, clickable to expand/collapse when there are details */}
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(e => !e)}
        className={`flex w-full items-center gap-2 text-left font-mono text-xs text-slate-500 ${hasDetails ? 'cursor-pointer hover:text-slate-400' : 'cursor-default'}`}>
        <span className="material-symbols-outlined text-[14px]">{toolMeta.icon}</span>
        <span className="pointer-events-none uppercase tracking-wider">{toolMeta.label}</span>
        {statusIcon}
        {hasDetails && (
          <span
            className={`material-symbols-outlined ml-auto text-[14px] transition-transform ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        )}
      </button>

      {/* Collapsed: nothing. Expanded: args + result */}
      {expanded && (
        <>
          {/* Code block with args */}
          {Object.entries(toolCall.args).length > 0 ? (
            <CodeBlock code={JSON.stringify(toolCall.args, null, 2)} language="json" />
          ) : (
            <CodeBlock code={t('chatToolNoArguments')} language="text" showLineNumbers={false} />
          )}

          {/* Result */}
          {toolCall.result && (
            <div>
              <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-600">{t('chatToolResult')}</div>
              <CodeBlock code={formatResult(toolCall.result)} language="json" maxHeight="8rem" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Relative to side-panel page URL so it works in extension and dev
const CONJURE_LOGO_URL = 'logo_vertical_dark.svg';

const MessageBubble = ({ message }: { message: AgentMessage }) => {
  if (message.role === 'user') {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <div
            className="rounded-2xl rounded-tr-md bg-slate-600/40 px-4 py-2.5 text-left text-sm leading-relaxed text-slate-200"
            dir="ltr">
            <span className="whitespace-pre-wrap">{message.content}</span>
          </div>
          <div className="flex items-center gap-2 pr-1 text-[10px] text-slate-500">
            <span>{formatRelativeTime(message.timestamp)}</span>
          </div>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-semibold uppercase text-slate-300"
          title={t('chatUserTitle')}>
          Y
        </div>
      </div>
    );
  }

  const isError = message.content.startsWith('Error:');

  return (
    <div className="flex flex-col gap-2">
      {/* Header: icon + Conjure name on one row */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700/80">
          <img src={CONJURE_LOGO_URL} alt={t('chatAgentName')} className="h-5 w-5 object-contain" />
        </div>
        <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {t('chatAgentName')}
        </div>
      </div>
      {/* Tools and response on the line below, fixed to the left */}
      <div className="space-y-2">
        {/* Display items (interleaved thinking + tool calls) with legacy fallback */}
        {message.displayItems && message.displayItems.length > 0 ? (
          <div className="space-y-3">
            {message.displayItems.map((item, i) =>
              item.kind === 'thinking' ? (
                <ThinkingBlock key={`thinking-${i}`} thinking={item.data} />
              ) : (
                <ToolCallBlock key={`${item.data.name}-${i}`} toolCall={item.data} />
              ),
            )}
          </div>
        ) : (
          <>
            {message.thinking && <ThinkingBlock thinking={message.thinking} />}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="space-y-3">
                {message.toolCalls.map((tc, i) => (
                  <ToolCallBlock key={`${tc.name}-${i}`} toolCall={tc} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Text content — no background */}
        {message.content && (
          <div className={`max-w-xl text-sm leading-relaxed ${isError ? 'text-red-400/80' : 'text-slate-300'}`}>
            <MarkdownContent content={message.content} />
          </div>
        )}
        <div className="text-[10px] text-slate-500">{formatRelativeTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

export const AgentChatPanel = ({ extensionId }: AgentChatPanelProps) => {
  const {
    messages,
    isRunning,
    isLoading,
    activeThinking,
    pendingInputRequest,
    sendMessage,
    stopAgent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clearChat: _clearChat,
    submitUserInput,
    cancelUserInput,
  } = useAgentChat(extensionId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isRunning) return;
      sendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-10 overflow-y-auto scroll-smooth p-6">
        {isLoading && (
          <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
            {t('chatLoading')}
          </div>
        )}

        {messages.length === 0 && !isRunning && !isLoading && (
          <div className="max-w-xl text-sm leading-relaxed text-slate-400">{t('chatEmptyState')}</div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Thinking / agent working — fixed to bottom above input */}
      <AgentThinking isRunning={isRunning} isThinking={!!activeThinking} onStop={stopAgent} />

      {/* Input */}
      <footer className="bg-background-dark border-terminal-border border-t px-6 py-4">
        {pendingInputRequest ? (
          <UserInputForm
            fields={pendingInputRequest.fields}
            title={pendingInputRequest.title}
            submitLabel={pendingInputRequest.submitLabel}
            onSubmit={submitUserInput}
            onCancel={cancelUserInput}
          />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-0 flex items-center">
                <span className="font-mono text-sm text-slate-600">&#x2318;</span>
              </div>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chatPlaceholder')}
                className="font-display w-full border-none bg-transparent py-2 pl-6 pr-24 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all focus:outline-none focus:ring-0"
                disabled={isRunning}
              />
              <div className="absolute right-0 flex items-center gap-3">
                <span className="hidden font-mono text-[10px] text-slate-700 sm:inline">GPT-4O_EXT</span>
                <button
                  type="submit"
                  disabled={isRunning || !input.trim()}
                  className="hover:text-primary text-slate-600 transition-colors disabled:opacity-30">
                  <span className="material-symbols-outlined text-lg">north_east</span>
                </button>
              </div>
            </div>
          </form>
        )}
        <div className="via-terminal-border mt-1 h-[1px] w-full bg-gradient-to-r from-transparent to-transparent opacity-50" />
      </footer>
    </div>
  );
};
