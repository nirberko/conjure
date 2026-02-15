let creating: Promise<void> | null = null;

export async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL('offscreen/index.html')],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creating) {
    await creating;
    return;
  }

  creating = chrome.offscreen.createDocument({
    url: 'offscreen/index.html',
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Run background worker scripts for Conjure extensions',
  });

  await creating;
  creating = null;
}

export async function closeOffscreenIfEmpty(): Promise<void> {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL('offscreen/index.html')],
    });

    if (existingContexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch {
    // May already be closed
  }
}
