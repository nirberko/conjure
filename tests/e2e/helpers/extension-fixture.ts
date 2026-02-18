import { test as base, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import type { BrowserContext, Worker } from '@playwright/test';
import type { Server } from 'node:http';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../../dist');

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  fixtureServer: { url: string; close: () => void };
}

// Playwright fixtures use `use()` callback — not React hooks
/* eslint-disable react-hooks/rules-of-hooks */
export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      channel: 'chromium',
      args: [
        `--headless=new`,
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-default-apps',
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    // Wait for the extension's service worker to be ready
    let sw = context.serviceWorkers().find(w => w.url().includes('background.js'));
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', {
        predicate: w => w.url().includes('background.js'),
        timeout: 30_000,
      });
    }
    await use(sw);
  },

  extensionId: async ({ serviceWorker }, use) => {
    // Extract extension ID from service worker URL: chrome-extension://<id>/background.js
    const url = serviceWorker.url();
    const match = url.match(/chrome-extension:\/\/([^/]+)\//);
    if (!match) throw new Error(`Could not extract extension ID from: ${url}`);
    await use(match[1]);
  },

  // eslint-disable-next-line no-empty-pattern
  fixtureServer: async ({}, use) => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/test-page.html');
    const html = readFileSync(fixturePath, 'utf-8');

    const server: Server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });

    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const url = `http://localhost:${port}`;

    await use({ url, close: () => server.close() });
    server.close();
  },
});

export { expect } from '@playwright/test';
