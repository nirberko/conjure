import { AgentThinking } from './AgentThinking';
import { MarkdownContent } from './MarkdownContent';
import { ThinkingBlock } from './ThinkingBlock';
import { useAgentChat } from '../hooks/useAgentChat';
import { useState, useRef, useEffect } from 'react';
import type { AgentMessage, ToolCallDisplay } from '../hooks/useAgentChat';

interface AgentChatPanelProps {
  extensionId: string;
}

/** Relative time e.g. "2 hours ago", "a few seconds ago" */
function formatRelativeTime(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 10) return 'a few seconds ago';
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min === 1) return '1 minute ago';
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr === 1) return '1 hour ago';
  if (hr < 24) return `${hr} hours ago`;
  const d = Math.floor(hr / 24);
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

function ToolCallBlock({ toolCall }: { toolCall: ToolCallDisplay }) {
  const [expanded, setExpanded] = useState(false);

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
        <span className="material-symbols-outlined text-[14px]">terminal</span>
        <span className="uppercase tracking-wider">
          {toolCall.status === 'pending' ? 'Running' : toolCall.status === 'skipped' ? 'Skipped' : 'Executed'}: {toolCall.name}
        </span>
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
          <div className="code-block overflow-x-auto rounded-md p-4 font-mono text-xs leading-6">
            {Object.entries(toolCall.args).length > 0 ? (
              JSON.stringify(toolCall.args, null, 2)
                .split('\n')
                .map((line, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="w-4 select-none text-right text-slate-700">{i + 1}</span>
                    <span className="text-slate-400">{line}</span>
                  </div>
                ))
            ) : (
              <div className="flex gap-4">
                <span className="w-4 select-none text-right text-slate-700">1</span>
                <span className="italic text-slate-500">No arguments</span>
              </div>
            )}
          </div>

          {/* Result */}
          {toolCall.result && (
            <div className="code-block max-h-32 overflow-x-auto overflow-y-auto rounded-md p-3 font-mono text-[10px] leading-5">
              <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-600">Result</div>
              <pre className="whitespace-pre-wrap text-slate-400">{formatResult(toolCall.result)}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Relative to side-panel page URL so it works in extension and dev
const WEBFORGE_LOGO_URL = 'logo_vertical_dark.svg';

function MessageBubble({ message }: { message: AgentMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-tr-md bg-slate-600/40 px-4 py-2.5 text-left text-sm leading-relaxed text-slate-200" dir="ltr">
            <span className="whitespace-pre-wrap">{message.content}</span>
          </div>
          <div className="flex items-center gap-2 pr-1 text-[10px] text-slate-500">
            <span>{formatRelativeTime(message.timestamp)}</span>
          </div>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-semibold uppercase text-slate-300"
          title="You">
          Y
        </div>
      </div>
    );
  }

  const isError = message.content.startsWith('Error:');

  return (
    <div className="flex flex-col gap-2">
      {/* Header: icon + WebForge name on one row */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700/80">
          <img
            src={WEBFORGE_LOGO_URL}
            alt="WebForge"
            className="h-5 w-5 object-contain"
          />
        </div>
        <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
          WebForge
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
          <div
            className={`max-w-xl text-sm leading-relaxed ${isError ? 'text-red-400/80' : 'text-slate-300'}`}>
            <MarkdownContent content={message.content} />
          </div>
        )}
        <div className="text-[10px] text-slate-500">
          {formatRelativeTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

export function AgentChatPanel({ extensionId }: AgentChatPanelProps) {
  const { messages, isRunning, isLoading, activeThinking, sendMessage, stopAgent, clearChat } =
    useAgentChat(extensionId);
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
            Loading conversation...
          </div>
        )}

        {messages.length === 0 && !isRunning && !isLoading && (
          <div className="max-w-xl text-sm leading-relaxed text-slate-400">
            Ready to initialize. Describe what you want to build. The agent will plan, generate, and deploy artifacts
            for you.
          </div>
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
              placeholder="Ask or command..."
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
        <div className="via-terminal-border mt-1 h-[1px] w-full bg-gradient-to-r from-transparent to-transparent opacity-50" />
      </footer>
    </div>
  );
}
