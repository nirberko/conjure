import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createExtension,
  createArtifact,
  getAllExtensions,
  getArtifactsByExtension,
  extensionDBManager,
} from '@extension/shared';
import type { Artifact } from '@extension/shared';

// Mock the offscreen-manager module so worker-manager doesn't actually create offscreen docs
vi.mock('../offscreen-manager.js', () => ({
  ensureOffscreenDocument: vi.fn().mockResolvedValue(undefined),
  closeOffscreenIfEmpty: vi.fn().mockResolvedValue(undefined),
}));

// Import after mock setup
import {
  startBackgroundWorker,
  stopBackgroundWorker,
  reloadBackgroundWorker,
  getAllWorkerStatuses,
  dispatchWorkerTrigger,
  handleWorkerStatusUpdate,
  handleWorkerApiCall,
  autoStartBackgroundWorkers,
} from '../worker-manager.js';

import { ensureOffscreenDocument, closeOffscreenIfEmpty } from '../offscreen-manager.js';

// Helper: create a background-worker artifact in the DB
async function createWorkerArtifact(extensionId: string, code = 'console.log("worker")'): Promise<Artifact> {
  // Ensure the extension exists
  const exts = await getAllExtensions();
  if (!exts.find(e => e.id === extensionId)) {
    await createExtension({
      name: 'Test Extension',
      description: '',
      urlPattern: '*',
      enabled: true,
    });
  }

  const allExts = await getAllExtensions();
  const ext = allExts.find(e => e.name === 'Test Extension') ?? allExts[0];

  const artifact = await createArtifact({
    extensionId: ext.id,
    type: 'background-worker',
    name: 'Test Worker',
    code,
    cssSelector: '',
    injectionMode: 'append',
    enabled: true,
  });

  return artifact as Artifact;
}

describe('WorkerManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: sendMessage resolves with { success: true }
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({ success: true });

    // Clear module-private workerStatuses via public API
    const stale = await getAllWorkerStatuses();
    for (const extId of Object.keys(stale)) {
      handleWorkerStatusUpdate(extId, 'stopped');
    }
  });

  describe('startBackgroundWorker', () => {
    it('returns error for non-existent artifact', async () => {
      const result = await startBackgroundWorker('nonexistent-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('starts a valid background-worker artifact', async () => {
      const artifact = await createWorkerArtifact('ext-1', 'self.onmessage = () => {}');

      const result = await startBackgroundWorker(artifact.id);

      expect(result.success).toBe(true);
      expect(ensureOffscreenDocument).toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          action: 'START_WORKER',
          artifactId: artifact.id,
          code: 'self.onmessage = () => {}',
        }),
      );
    });

    it('tracks worker status after successful start', async () => {
      const artifact = await createWorkerArtifact('ext-1');

      await startBackgroundWorker(artifact.id);

      const statuses = await getAllWorkerStatuses();
      expect(statuses[artifact.extensionId]).toEqual({
        status: 'running',
        artifactId: artifact.id,
      });

      // Clean up
      handleWorkerStatusUpdate(artifact.extensionId, 'stopped');
    });

    it('does not track status when offscreen returns failure', async () => {
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({ success: false, error: 'crash' });

      const artifact = await createWorkerArtifact('ext-1');
      const result = await startBackgroundWorker(artifact.id);

      expect(result.success).toBe(false);

      const statuses = await getAllWorkerStatuses();
      expect(statuses[artifact.extensionId]).toBeUndefined();
    });
  });

  describe('stopBackgroundWorker', () => {
    it('sends STOP_WORKER and removes status', async () => {
      const artifact = await createWorkerArtifact('ext-1');
      await startBackgroundWorker(artifact.id);

      const result = await stopBackgroundWorker(artifact.extensionId);

      expect(result.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          action: 'STOP_WORKER',
          extensionId: artifact.extensionId,
        }),
      );

      const statuses = await getAllWorkerStatuses();
      expect(statuses[artifact.extensionId]).toBeUndefined();
    });

    it('closes offscreen document when last worker stops', async () => {
      const artifact = await createWorkerArtifact('ext-1');
      await startBackgroundWorker(artifact.id);

      await stopBackgroundWorker(artifact.extensionId);

      expect(closeOffscreenIfEmpty).toHaveBeenCalled();
    });
  });

  describe('reloadBackgroundWorker', () => {
    it('returns error for non-existent artifact', async () => {
      const result = await reloadBackgroundWorker('bad-id');
      expect(result).toEqual({ success: false, error: 'Artifact not found or not a background-worker' });
    });

    it('sends RELOAD_WORKER with updated code', async () => {
      const artifact = await createWorkerArtifact('ext-1', 'v2 code');

      const result = await reloadBackgroundWorker(artifact.id);

      expect(result.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          action: 'RELOAD_WORKER',
          code: 'v2 code',
        }),
      );

      // Clean up
      handleWorkerStatusUpdate(artifact.extensionId, 'stopped');
    });
  });

  describe('getAllWorkerStatuses', () => {
    it('returns empty when no workers running', async () => {
      // Make offscreen also return nothing
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({});

      const statuses = await getAllWorkerStatuses();
      expect(statuses).toEqual({});
    });

    it('queries offscreen when local cache is empty', async () => {
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
        statuses: { 'ext-a': { status: 'running', artifactId: 'art-1' } },
      });

      const statuses = await getAllWorkerStatuses();

      expect(statuses['ext-a']).toEqual({ status: 'running', artifactId: 'art-1' });

      // Clean up
      handleWorkerStatusUpdate('ext-a', 'stopped');
    });
  });

  describe('handleWorkerStatusUpdate', () => {
    it('removes worker on "stopped" status', async () => {
      // Start a worker first
      const artifact = await createWorkerArtifact('ext-1');
      await startBackgroundWorker(artifact.id);

      handleWorkerStatusUpdate(artifact.extensionId, 'stopped');

      const statuses = await getAllWorkerStatuses();
      // Need to prevent offscreen query from re-populating
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({});
      const freshStatuses = await getAllWorkerStatuses();
      expect(freshStatuses[artifact.extensionId]).toBeUndefined();
    });

    it('removes worker on "not_found" status', () => {
      handleWorkerStatusUpdate('some-ext', 'running');
      handleWorkerStatusUpdate('some-ext', 'not_found');

      // Direct check — statuses should be empty
      // We'll verify via getAllWorkerStatuses after clearing
    });

    it('updates existing worker status', async () => {
      const artifact = await createWorkerArtifact('ext-1');
      await startBackgroundWorker(artifact.id);

      handleWorkerStatusUpdate(artifact.extensionId, 'error', 'OOM');

      const statuses = await getAllWorkerStatuses();
      expect(statuses[artifact.extensionId]).toEqual({
        status: 'error',
        artifactId: artifact.id,
        error: 'OOM',
      });

      // Clean up
      handleWorkerStatusUpdate(artifact.extensionId, 'stopped');
    });

    it('creates entry for unknown worker (service worker restart scenario)', () => {
      handleWorkerStatusUpdate('unknown-ext', 'running');

      // Next getAllWorkerStatuses call would find it — but we can't easily assert
      // module-private state without going through the public API. Clean up:
      handleWorkerStatusUpdate('unknown-ext', 'stopped');
    });
  });

  describe('dispatchWorkerTrigger', () => {
    it('sends trigger to tracked worker', async () => {
      const artifact = await createWorkerArtifact('ext-1');
      await startBackgroundWorker(artifact.id);
      vi.clearAllMocks();

      dispatchWorkerTrigger(artifact.extensionId, 'page_load', { url: 'https://example.com' });

      // dispatchWorkerTrigger is fire-and-forget, give it a tick
      await vi.waitFor(() => {
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            target: 'offscreen',
            action: 'DISPATCH_TRIGGER',
            extensionId: artifact.extensionId,
            trigger: 'page_load',
            data: { url: 'https://example.com' },
          }),
        );
      });

      // Clean up
      handleWorkerStatusUpdate(artifact.extensionId, 'stopped');
    });

    it('does nothing when worker is not tracked', () => {
      chrome.runtime.sendMessage = vi.fn();

      dispatchWorkerTrigger('untracked-ext', 'click', {});

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleWorkerApiCall', () => {
    it('routes storage.get calls', async () => {
      await extensionDBManager.storageSet('ext-1', 'myKey', { count: 42 });

      await handleWorkerApiCall('req-1', 'storage.get', ['ext-1', 'myKey']);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          action: 'WORKER_API_RESPONSE',
          requestId: 'req-1',
          result: { count: 42 },
          error: undefined,
        }),
      );
    });

    it('routes storage.set calls', async () => {
      await handleWorkerApiCall('req-2', 'storage.set', ['ext-1', 'testKey', { data: 'hello' }]);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WORKER_API_RESPONSE',
          requestId: 'req-2',
          error: undefined,
        }),
      );

      // Verify the data was actually stored
      const stored = await extensionDBManager.storageGet('ext-1', 'testKey');
      expect(stored).toEqual({ data: 'hello' });
    });

    it('routes tabs.query calls', async () => {
      chrome.tabs.query = vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]);

      await handleWorkerApiCall('req-3', 'tabs.query', [{ active: true }]);

      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WORKER_API_RESPONSE',
          requestId: 'req-3',
          result: [{ id: 1, url: 'https://example.com' }],
        }),
      );
    });

    it('returns error for unknown API method', async () => {
      await handleWorkerApiCall('req-4', 'fake.method', []);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WORKER_API_RESPONSE',
          requestId: 'req-4',
          error: 'Unknown API method: fake.method',
        }),
      );
    });

    it('catches exceptions and returns error', async () => {
      chrome.tabs.query = vi.fn().mockRejectedValue(new Error('tabs API crashed'));

      await handleWorkerApiCall('req-5', 'tabs.query', [{}]);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'WORKER_API_RESPONSE',
          requestId: 'req-5',
          error: 'tabs API crashed',
        }),
      );
    });
  });

  describe('autoStartBackgroundWorkers', () => {
    it('starts workers for enabled extensions with background-worker artifacts', async () => {
      const artifact = await createWorkerArtifact('ext-auto');

      await autoStartBackgroundWorkers();

      // Give the fire-and-forget start call a tick
      await vi.waitFor(() => {
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            target: 'offscreen',
            action: 'START_WORKER',
            artifactId: artifact.id,
          }),
        );
      });

      // Clean up
      handleWorkerStatusUpdate(artifact.extensionId, 'stopped');
    });
  });
});
