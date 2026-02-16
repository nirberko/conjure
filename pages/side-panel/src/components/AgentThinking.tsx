import { t } from '@extension/i18n';

interface AgentThinkingProps {
  isRunning: boolean;
  isThinking?: boolean;
  onStop: () => void;
}

export const AgentThinking = ({ isRunning, isThinking, onStop }: AgentThinkingProps) => {
  if (!isRunning) return null;

  const label = isThinking ? t('agentThinking') : t('agentWorking');

  return (
    <div className="flex items-center gap-3 border border-terminal-border bg-black/40 px-3 py-2">
      <div className="thinking-dots flex items-center gap-1">
        <span className="dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <button
        onClick={onStop}
        className="ml-auto font-mono text-[10px] uppercase tracking-tighter text-red-500/70 underline-offset-4 transition-all hover:text-red-400 hover:underline">
        {t('commonStop')}
      </button>
    </div>
  );
};
