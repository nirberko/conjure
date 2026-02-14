import {
  createWorkerInstance,
  stopWorkerInstance,
  getWorker,
  getAllWorkers,
  getWorkerStatuses,
} from './worker-registry.js';
import { createWorkerShim, resolveApiCall } from './worker-shim.js';

console.log('[WebForge Offscreen] Worker runtime loaded');

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  const handler = async () => {
    switch (message.action) {
      case 'START_WORKER': {
        const { extensionId, artifactId, code } = message;
        return startWorker(extensionId, artifactId, code);
      }

      case 'STOP_WORKER': {
        const { extensionId } = message;
        const stopped = stopWorkerInstance(extensionId);
        notifyStatusUpdate(extensionId, stopped ? 'stopped' : 'not_found');
        return { success: stopped };
      }

      case 'RELOAD_WORKER': {
        const { extensionId, artifactId, code } = message;
        stopWorkerInstance(extensionId);
        return startWorker(extensionId, artifactId, code);
      }

      case 'DISPATCH_TRIGGER': {
        const { extensionId, trigger, data } = message;
        return dispatchTrigger(extensionId, trigger, data);
      }

      case 'WORKER_API_RESPONSE': {
        const { requestId, result, error } = message;
        resolveApiCall(requestId, result, error);
        return { success: true };
      }

      case 'BROADCAST_STORAGE_CHANGE': {
        const { extensionId, changes } = message;
        return dispatchTrigger(extensionId, 'storage_change', changes);
      }

      case 'GET_STATUSES': {
        return { statuses: getWorkerStatuses() };
      }

      default:
        return { error: `Unknown offscreen action: ${message.action}` };
    }
  };

  handler()
    .then(sendResponse)
    .catch(err => {
      console.error('[WebForge Offscreen] Handler error:', err);
      sendResponse({ error: err.message });
    });

  return true;
});

function startWorker(extensionId: string, artifactId: string, code: string): { success: boolean; error?: string } {
  // Stop existing worker for this extension if any
  const existing = getWorker(extensionId);
  if (existing) {
    stopWorkerInstance(extensionId);
  }

  const instance = createWorkerInstance(extensionId, artifactId);
  const shim = createWorkerShim(instance);

  try {
    // Execute worker code with the webforge shim
    const workerFn = new Function('webforge', code);
    workerFn(shim);

    instance.status = 'running';
    notifyStatusUpdate(extensionId, 'running');
    console.log(`[WebForge Offscreen] Worker started for extension: ${extensionId}`);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    instance.status = 'error';
    instance.error = errorMsg;
    notifyStatusUpdate(extensionId, 'error', errorMsg);
    console.error(`[WebForge Offscreen] Worker start failed for ${extensionId}:`, err);
    return { success: false, error: errorMsg };
  }
}

function dispatchTrigger(extensionId: string, trigger: string, data: unknown): { success: boolean; error?: string } {
  const instance = getWorker(extensionId);
  if (!instance || instance.status !== 'running') {
    return { success: false, error: 'Worker not running' };
  }

  const handlers = instance.handlers.get(trigger) ?? [];
  for (const handler of handlers) {
    try {
      handler(data);
    } catch (err) {
      console.error(`[WebForge Offscreen] Trigger handler error (${trigger}):`, err);
    }
  }
  return { success: true };
}

function notifyStatusUpdate(extensionId: string, status: string, error?: string) {
  chrome.runtime
    .sendMessage({
      target: 'service-worker',
      action: 'WORKER_STATUS_UPDATE',
      extensionId,
      status,
      ...(error ? { error } : {}),
    })
    .catch(() => {});
}

// Notify service worker that offscreen is ready
chrome.runtime
  .sendMessage({
    target: 'service-worker',
    action: 'OFFSCREEN_READY',
  })
  .catch(() => {});
