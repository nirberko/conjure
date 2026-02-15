import 'fake-indexeddb/auto';
import { createChromeMock } from './chrome-mock.js';
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  (globalThis as Record<string, unknown>).chrome = createChromeMock();
});

afterEach(async () => {
  // Clear all tables in the main DB rather than deleting it
  // (deleting would invalidate the Dexie singleton)
  try {
    const { db } = await import('../db/index.js');
    for (const table of db.tables) {
      await table.clear();
    }
  } catch {
    // DB module may not be loaded in all test contexts
  }
  delete (globalThis as Record<string, unknown>).chrome;
});
