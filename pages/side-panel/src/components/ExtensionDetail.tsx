import { AgentChatPanel } from './AgentChatPanel';
import { ArtifactList } from './ArtifactList';
import { DatabaseBrowser } from './DatabaseBrowser';
import { EnvManager } from './EnvManager';
import { t } from '@extension/i18n';
import { useState } from 'react';
import type { Extension } from '@extension/shared';

interface ExtensionDetailProps {
  extension: Extension;
  onBack: () => void;
}

type SubTab = 'chat' | 'artifacts' | 'database' | 'env';

export const ExtensionDetail = ({ extension, onBack }: ExtensionDetailProps) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('chat');

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'chat', label: t('extensionDetailTabChat') },
    { id: 'artifacts', label: t('extensionDetailTabArtifacts') },
    { id: 'database', label: t('extensionDetailTabDatabase') },
    { id: 'env', label: t('extensionDetailTabEnv') },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-terminal-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-500 transition-colors hover:text-primary">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate text-xs font-semibold tracking-tight text-slate-200">{extension.name}</h1>
            </div>
          </div>
          <button className="text-slate-500 transition-colors hover:text-white">
            <span className="material-symbols-outlined text-lg">settings</span>
          </button>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 border border-terminal-border bg-black/40 px-3 py-1.5">
          <span className="material-symbols-outlined text-[14px] text-slate-500">language</span>
          <span className="truncate font-mono text-[10px] text-slate-400">{extension.urlPattern}</span>
        </div>
      </header>

      {/* Sub-tabs */}
      <nav className="flex border-b border-terminal-border bg-black/20 px-4">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`relative px-4 py-3 text-[11px] font-medium uppercase tracking-widest transition-all ${
              activeSubTab === tab.id
                ? 'border-b border-primary text-primary'
                : 'border-b border-transparent text-slate-600 hover:text-slate-400'
            }`}>
            {tab.label}
            {activeSubTab === tab.id && (
              <span className="absolute bottom-0 left-0 h-[1px] w-full bg-primary blur-[2px]" />
            )}
            {tab.id === 'artifacts' && activeSubTab !== 'artifacts' && (
              <span className="ml-2 inline-block h-1 w-1 rounded-full bg-primary/60" />
            )}
          </button>
        ))}
      </nav>

      {/* Content — all tabs stay mounted, hidden with CSS to preserve state */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full" style={{ display: activeSubTab === 'chat' ? undefined : 'none' }}>
          <AgentChatPanel extensionId={extension.id} />
        </div>
        <div className="h-full" style={{ display: activeSubTab === 'artifacts' ? undefined : 'none' }}>
          <ArtifactList extensionId={extension.id} isActive={activeSubTab === 'artifacts'} />
        </div>
        <div className="h-full" style={{ display: activeSubTab === 'database' ? undefined : 'none' }}>
          <DatabaseBrowser extensionId={extension.id} isActive={activeSubTab === 'database'} />
        </div>
        <div className="h-full" style={{ display: activeSubTab === 'env' ? undefined : 'none' }}>
          <EnvManager extensionId={extension.id} isActive={activeSubTab === 'env'} />
        </div>
      </div>
    </div>
  );
};
