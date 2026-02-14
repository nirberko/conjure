import { useState } from 'react';
import type { ThinkingData } from '../hooks/useAgentChat';

interface ThinkingBlockProps {
  thinking: ThinkingData;
}

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const seconds = Math.round(thinking.durationMs / 1000);
  const label = seconds === 1 ? 'Thought for 1s' : `Thought for ${seconds}s`;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left font-mono text-xs text-slate-500 transition-colors hover:text-slate-400">
        <span className="material-symbols-outlined text-[14px]">psychology</span>
        <span className="uppercase tracking-wider">{label}</span>
        <span
          className={`material-symbols-outlined ml-auto text-[14px] transition-transform ${expanded ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {expanded && (
        <div className="code-block overflow-x-auto rounded-md p-4 font-mono text-xs leading-6">
          <pre className="whitespace-pre-wrap text-slate-400">{thinking.content}</pre>
        </div>
      )}
    </div>
  );
}
