import type { BrowserContext, Page } from '@playwright/test';

interface SetupResult {
  extensionUUID: string;
  setupPage: Page;
}

/**
 * Seeds AI provider settings and creates a Conjure extension via
 * chrome.runtime.sendMessage from an extension popup page.
 */
export const setupExtension = async (
  context: BrowserContext,
  extensionId: string,
  options: {
    provider?: string;
    apiKey: string;
    model?: string;
    extensionName?: string;
    urlPattern?: string;
  },
): Promise<SetupResult> => {
  const {
    provider = 'openai',
    apiKey,
    model = 'gpt-4o',
    extensionName = 'E2E Test Extension',
    urlPattern = '*://*/*',
  } = options;

  // Navigate to popup page to get chrome.runtime access
  const setupPage = await context.newPage();
  await setupPage.goto(`chrome-extension://${extensionId}/popup/index.html`, {
    waitUntil: 'domcontentloaded',
  });

  // Seed AI settings
  const setSettings = async (key: string, value: unknown) =>
    setupPage.evaluate(
      ({ key, value }) => chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { key, value } }),
      { key, value },
    );

  await setSettings('ai_provider', provider);
  await setSettings(`ai_api_key_${provider}`, apiKey);
  await setSettings('ai_model', model);

  // Create an extension
  const result = await setupPage.evaluate(
    ({ name, urlPattern }) =>
      chrome.runtime.sendMessage({
        type: 'CREATE_EXTENSION',
        payload: { name, urlPattern, enabled: true },
      }),
    { name: extensionName, urlPattern },
  );

  const extensionUUID = (result as { extension: { id: string } }).extension.id;
  if (!extensionUUID) {
    throw new Error(`CREATE_EXTENSION failed: ${JSON.stringify(result)}`);
  }

  return { extensionUUID, setupPage };
};
