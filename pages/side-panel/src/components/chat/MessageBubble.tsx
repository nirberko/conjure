import { ToolCallBlock } from './ToolCallBlock';
import { formatRelativeTime } from '../../utils/format-time';
import { MarkdownContent } from '../MarkdownContent';
import { ThinkingBlock } from '../ThinkingBlock';
import { t } from '@extension/i18n';
import type { AgentChatMessage } from '@extension/shared';

// Relative to side-panel page URL so it works in extension and dev
const CONJURE_LOGO_URL = 'logo_vertical_dark.svg';

export const MessageBubble = ({ message }: { message: AgentChatMessage }) => {
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
