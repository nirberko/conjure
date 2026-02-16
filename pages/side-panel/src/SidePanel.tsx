import '@src/SidePanel.css';
import { ExtensionDetail } from './components/ExtensionDetail';
import { ExtensionList } from './components/ExtensionList';
import { ProviderSettings } from './components/ProviderSettings';
import { useExtensions } from './hooks/useExtensions';
import { t } from '@extension/i18n';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui/components';
import { useState } from 'react';
import type { Extension } from '@extension/shared';

type MainView = 'extensions' | 'settings';

const SidePanel = () => {
  const [mainView, setMainView] = useState<MainView>('extensions');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const version = (() => {
    try {
      return chrome.runtime.getManifest().version;
    } catch {
      return 'dev';
    }
  })();
  const { extensions, loading: extLoading, createExtension, toggleExtension, deleteExtension } = useExtensions();

  // If an extension is selected, show its detail view
  if (selectedExtension) {
    return (
      <div className="relative flex h-screen flex-col overflow-hidden bg-background-dark font-display text-slate-300">
        <ExtensionDetail extension={selectedExtension} onBack={() => setSelectedExtension(null)} />
        {/* Background glow */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
        </div>
      </div>
    );
  }

  const navItems: { id: MainView; label: string }[] = [
    { id: 'extensions', label: t('sidePanelTabExtensions') },
    { id: 'settings', label: t('sidePanelTabSettings') },
  ];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background-dark font-display text-slate-300">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-terminal-border bg-background-dark">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">terminal</span>
            <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">{t('sidePanelTitle')}</h1>
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
                  ? 'border-b border-primary text-white'
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
      <footer className="fixed bottom-0 z-10 flex w-full items-center justify-between border-t border-terminal-border bg-background-dark px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-primary shadow-[0_0_5px_#00f2ff]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {t('sidePanelStatusReady')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] tracking-tighter text-slate-700">v{version}</span>
          <span className="material-symbols-outlined text-[14px] text-slate-700">sensors</span>
        </div>
      </footer>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
