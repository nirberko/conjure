import '@src/SidePanel.css';
import { ExtensionDetail } from './components/ExtensionDetail';
import { ExtensionList } from './components/ExtensionList';
import { ProviderSettings } from './components/ProviderSettings';
import { useExtensions } from './hooks/useExtensions';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState } from 'react';
import type { Extension } from '@extension/shared';

type MainView = 'extensions' | 'settings';

const SidePanel = () => {
  const [mainView, setMainView] = useState<MainView>('extensions');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const { extensions, loading: extLoading, createExtension, toggleExtension, deleteExtension } = useExtensions();

  // If an extension is selected, show its detail view
  if (selectedExtension) {
    return (
      <div className="bg-background-dark font-display relative flex h-screen flex-col overflow-hidden text-slate-300">
        <ExtensionDetail extension={selectedExtension} onBack={() => setSelectedExtension(null)} />
        {/* Background glow */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="bg-primary/5 absolute right-0 top-0 h-[400px] w-[400px] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
        </div>
      </div>
    );
  }

  const navItems: { id: MainView; label: string }[] = [
    { id: 'extensions', label: 'Extensions' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="bg-background-dark font-display relative flex h-screen flex-col overflow-hidden text-slate-300">
      {/* Header */}
      <header className="bg-background-dark border-terminal-border sticky top-0 z-10 border-b">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">terminal</span>
            <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">WebForge</h1>
          </div>
          <button className="text-slate-600 transition-colors hover:text-white">
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>

        {/* Main Tabs */}
        <nav className="flex gap-6 px-5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setMainView(item.id)}
              className={`pb-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                mainView === item.id
                  ? 'border-primary border-b text-white'
                  : 'border-b border-transparent text-slate-600 hover:text-slate-400'
              }`}>
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-12">
        {mainView === 'extensions' && (
          <ExtensionList
            extensions={extensions}
            loading={extLoading}
            onSelect={setSelectedExtension}
            onCreate={createExtension}
            onToggle={toggleExtension}
            onDelete={deleteExtension}
          />
        )}

        {mainView === 'settings' && <ProviderSettings />}
      </main>

      {/* Footer */}
      <footer className="bg-background-dark border-terminal-border fixed bottom-0 z-10 flex w-full items-center justify-between border-t px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary h-1 w-1 rounded-full shadow-[0_0_5px_#00f2ff]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Ready</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] tracking-tighter text-slate-700">1.2.4-stable</span>
          <span className="material-symbols-outlined text-[14px] text-slate-700">sensors</span>
        </div>
      </footer>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="bg-primary/5 absolute right-0 top-0 h-[400px] w-[400px] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
