import { getToolMetadata } from '../../utils/tool-metadata';
import { CodeBlock } from '../CodeBlock';
import { t } from '@extension/i18n';
import { useState } from 'react';
import type { ToolCallDisplay } from '@extension/shared';

export const ToolCallBlock = ({ toolCall }: { toolCall: ToolCallDisplay }) => {
  const [expanded, setExpanded] = useState(false);
  const toolMeta = getToolMetadata(toolCall.name);

  const safeArgs = toolCall.args ?? {};

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

  const hasDetails = Object.entries(safeArgs).length > 0 || (toolCall.result != null && toolCall.result !== '');

  return (
    <div className="space-y-2">
      {/* Header: always visible, clickable to expand/collapse when there are details */}
      <button
        type="button"
        disabled={!hasDetails}
        aria-disabled={!hasDetails}
        onClick={hasDetails ? () => setExpanded(e => !e) : undefined}
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
          {Object.entries(safeArgs).length > 0 ? (
            <CodeBlock code={JSON.stringify(safeArgs, null, 2)} language="json" />
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
