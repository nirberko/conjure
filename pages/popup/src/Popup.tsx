import '@src/Popup.css';
import { t } from '@extension/i18n';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui/components';

const Popup = () => {
  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  };

  return (
    <div className="flex min-h-[120px] min-w-[200px] flex-col items-center justify-center bg-background-dark p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-2 w-2 bg-primary" />
        <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">{t('popupTitle')}</h1>
      </div>
      <button
        className="flex w-full items-center justify-center gap-2 border border-primary/40 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-primary transition-all hover:border-primary hover:bg-primary/5"
        onClick={openSidePanel}>
        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        {t('popupOpenSidePanel')}
      </button>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
