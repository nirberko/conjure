import '@src/Popup.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';

const Popup = () => {
  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  };

  return (
    <div className="bg-background-dark flex min-h-[120px] min-w-[200px] flex-col items-center justify-center p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="bg-primary h-2 w-2" />
        <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">WebForge</h1>
      </div>
      <button
        className="border-primary/40 hover:border-primary text-primary hover:bg-primary/5 flex w-full items-center justify-center gap-2 border py-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-all"
        onClick={openSidePanel}>
        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        Open Side Panel
      </button>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
