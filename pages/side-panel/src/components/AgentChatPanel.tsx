import { AgentThinking } from './AgentThinking';
import { MessageBubble } from './chat/MessageBubble';
import { UserInputForm } from './UserInputForm';
import { useAgentChat } from '../hooks/useAgentChat';
import { t } from '@extension/i18n';
import { useState, useRef, useEffect, useCallback } from 'react';

interface AgentChatPanelProps {
  extensionId: string;
}

export const AgentChatPanel = ({ extensionId }: AgentChatPanelProps) => {
  const {
    messages,
    isRunning,
    isLoading,
    activeThinking,
    pendingInputRequest,
    sendMessage,
    stopAgent,
    submitUserInput,
    cancelUserInput,
  } = useAgentChat(extensionId);
  const [input, setInput] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      const el = scrollContainerRef.current;
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isRunning) return;
    sendMessage(input.trim());
    setInput('');
  }, [input, isRunning, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 space-y-10 overflow-y-auto scroll-smooth p-6">
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
      </div>

      {/* Thinking / agent working — fixed to bottom above input */}
      <AgentThinking isRunning={isRunning} isThinking={!!activeThinking} onStop={stopAgent} />

      {/* Input */}
      <footer className="border-t border-terminal-border bg-background-dark px-6 py-4">
        {pendingInputRequest ? (
          <UserInputForm
            fields={pendingInputRequest.fields}
            title={pendingInputRequest.title}
            submitLabel={pendingInputRequest.submitLabel}
            onSubmit={submitUserInput}
            onCancel={cancelUserInput}
          />
        ) : (
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}>
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
                className="w-full border-none bg-transparent py-2 pl-6 pr-24 font-display text-sm text-slate-200 placeholder-slate-600 outline-none transition-all focus:outline-none focus:ring-0"
                disabled={isRunning}
              />
              <div className="absolute right-0 flex items-center gap-3">
                <span className="hidden font-mono text-[10px] text-slate-700 sm:inline">GPT-4O_EXT</span>
                <button
                  type="submit"
                  disabled={isRunning || !input.trim()}
                  className="text-slate-600 transition-colors hover:text-primary disabled:opacity-30">
                  <span className="material-symbols-outlined text-lg">north_east</span>
                </button>
              </div>
            </div>
          </form>
        )}
        <div className="mt-1 h-[1px] w-full bg-gradient-to-r from-transparent via-terminal-border to-transparent opacity-50" />
      </footer>
    </div>
  );
};
