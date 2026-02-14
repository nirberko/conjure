import { AgentChatPanel } from './AgentChatPanel';
import { ArtifactList } from './ArtifactList';
import { useState } from 'react';
import type { Extension } from '@extension/shared';

interface ExtensionDetailProps {
  extension: Extension;
  onBack: () => void;
}

type SubTab = 'chat' | 'artifacts';

export function ExtensionDetail({ extension, onBack }: ExtensionDetailProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('chat');

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'artifacts', label: 'Artifacts' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-terminal-border flex flex-col gap-3 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="hover:text-primary text-slate-500 transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate text-xs font-semibold tracking-tight text-slate-200">{extension.name}</h1>
              <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-widest text-slate-600">
                Runtime: WebForge_v4
              </p>
            </div>
          </div>
          <button className="text-slate-500 transition-colors hover:text-white">
            <span className="material-symbols-outlined text-lg">settings</span>
          </button>
        </div>

        {/* URL bar */}
        <div className="border-terminal-border flex items-center gap-2 border bg-black/40 px-3 py-1.5">
          <span className="material-symbols-outlined text-[14px] text-slate-500">language</span>
          <span className="truncate font-mono text-[10px] text-slate-400">{extension.urlPattern}</span>
        </div>
      </header>

      {/* Sub-tabs */}
      <nav className="border-terminal-border flex border-b bg-black/20 px-4">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`relative px-4 py-3 text-[11px] font-medium uppercase tracking-widest transition-all ${
              activeSubTab === tab.id
                ? 'text-primary border-primary border-b'
                : 'border-b border-transparent text-slate-600 hover:text-slate-400'
            }`}>
            {tab.label}
            {activeSubTab === tab.id && (
              <span className="bg-primary absolute bottom-0 left-0 h-[1px] w-full blur-[2px]" />
            )}
            {tab.id === 'artifacts' && activeSubTab !== 'artifacts' && (
              <span className="bg-primary/60 ml-2 inline-block h-1 w-1 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSubTab === 'chat' && <AgentChatPanel extensionId={extension.id} />}
        {activeSubTab === 'artifacts' && <ArtifactList extensionId={extension.id} />}
      </div>
    </div>
  );
}
