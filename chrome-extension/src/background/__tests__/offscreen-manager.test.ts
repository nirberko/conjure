import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureOffscreenDocument, closeOffscreenIfEmpty } from '../offscreen-manager.js';

describe('OffscreenManager', () => {
  beforeEach(() => {
    // Reset the module-level `creating` promise between tests
    vi.resetModules();
  });

  describe('ensureOffscreenDocument', () => {
    it('creates document when none exists', async () => {
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([]);

      await ensureOffscreenDocument();

      expect(chrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: 'offscreen/index.html',
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: 'Run background worker scripts for WebForge extensions',
      });
    });

    it('skips creation when document already exists', async () => {
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ documentUrl: 'chrome-extension://mock-id/offscreen/index.html' }]);

      await ensureOffscreenDocument();

      expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent create calls', async () => {
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([]);

      // Slow creation to simulate concurrent calls
      let resolveCreate!: () => void;
      chrome.offscreen.createDocument = vi.fn().mockReturnValue(
        new Promise<void>(resolve => {
          resolveCreate = resolve;
        }),
      );

      // Fire two concurrent calls
      const p1 = ensureOffscreenDocument();
      const p2 = ensureOffscreenDocument();

      resolveCreate();
      await Promise.all([p1, p2]);

      // createDocument should only be called once
      expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeOffscreenIfEmpty', () => {
    it('closes document when it exists', async () => {
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ documentUrl: 'chrome-extension://mock-id/offscreen/index.html' }]);

      await closeOffscreenIfEmpty();

      expect(chrome.offscreen.closeDocument).toHaveBeenCalled();
    });

    it('does nothing when no document exists', async () => {
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([]);

      await closeOffscreenIfEmpty();

      expect(chrome.offscreen.closeDocument).not.toHaveBeenCalled();
    });

    it('swallows errors if close fails', async () => {
      chrome.runtime.getContexts = vi.fn().mockResolvedValue([{ documentUrl: 'x' }]);
      chrome.offscreen.closeDocument = vi.fn().mockRejectedValue(new Error('already closed'));

      // Should not throw
      await expect(closeOffscreenIfEmpty()).resolves.toBeUndefined();
    });
  });
});
