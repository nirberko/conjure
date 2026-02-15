import {
  createWorkerInstance,
  stopWorkerInstance,
  getWorker,
  getAllWorkers,
  getWorkerStatuses,
} from './worker-registry.js';

console.log('[Conjure Offscreen] Worker runtime loaded');

// ---------------------------------------------------------------------------
// postMessage relay: sandbox iframe → service worker
// ---------------------------------------------------------------------------

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

  switch (msg.type) {
    case 'API_CALL': {
      // Forward API call from sandbox to service worker
      const { requestId, method, args } = msg;
      chrome.runtime
        .sendMessage({
          target: 'service-worker',
          action: 'WORKER_API_CALL',
          requestId,
          method,
          args,
        })
        .catch(err => {
          // If the service worker call fails, relay error back to sandbox
          const sourceIframe = findIframeBySource(event.source);
          sourceIframe?.contentWindow?.postMessage(
            { type: 'API_RESPONSE', requestId, result: undefined, error: err.message },
            '*',
          );
        });
      break;
    }

    case 'WORKER_LOG': {
      // Forward log from sandbox to service worker
      const { extensionId, level, args } = msg;
      chrome.runtime
        .sendMessage({
          target: 'service-worker',
          action: 'WORKER_LOG',
          extensionId,
          level,
          args,
        })
        .catch(() => {});
      break;
    }

    case 'EXEC_RESULT': {
      // Handled inline in startWorker via the execResultPromise
      break;
    }
  }
});

function findIframeBySource(source: MessageEventSource | null): HTMLIFrameElement | undefined {
  if (!source) return undefined;
  for (const [, worker] of getAllWorkers()) {
    if (worker.iframe.contentWindow === source) {
      return worker.iframe;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// chrome.runtime message handler: service worker → offscreen
// ---------------------------------------------------------------------------

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
        // Forward API response to the correct worker's sandbox iframe
        forwardApiResponse(requestId, result, error);
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
      console.error('[Conjure Offscreen] Handler error:', err);
      sendResponse({ error: err.message });
    });

  return true;
});

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

async function startWorker(
  extensionId: string,
  artifactId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  // Stop existing worker for this extension if any
  const existing = getWorker(extensionId);
  if (existing) {
    stopWorkerInstance(extensionId);
  }

  // Create sandboxed iframe
  const iframe = document.createElement('iframe');
  iframe.src = '../sandbox-worker/index.html';
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  // Wait for iframe to load
  await new Promise<void>((resolve, reject) => {
    iframe.addEventListener('load', () => resolve(), { once: true });
    iframe.addEventListener('error', () => reject(new Error('Failed to load sandbox iframe')), { once: true });
  });

  // Create a one-time promise to capture the EXEC_RESULT from the sandbox
  const execResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const msg = event.data;
      if (msg?.type === 'EXEC_RESULT') {
        window.removeEventListener('message', onMessage);
        resolve(msg as { success: boolean; error?: string });
      }
    };
    window.addEventListener('message', onMessage);

    // Send code to sandbox for execution
    iframe.contentWindow!.postMessage(
      { type: 'EXEC_WORKER', code, extensionId, artifactId },
      '*',
    );
  });

  if (execResult.success) {
    const instance = createWorkerInstance(extensionId, artifactId, iframe);
    instance.status = 'running';
    notifyStatusUpdate(extensionId, 'running');
    console.log(`[Conjure Offscreen] Worker started for extension: ${extensionId}`);
    return { success: true };
  } else {
    // Execution failed — clean up iframe
    iframe.remove();
    notifyStatusUpdate(extensionId, 'error', execResult.error);
    console.error(`[Conjure Offscreen] Worker start failed for ${extensionId}:`, execResult.error);
    return { success: false, error: execResult.error };
  }
}

function dispatchTrigger(extensionId: string, trigger: string, data: unknown): { success: boolean; error?: string } {
  const instance = getWorker(extensionId);
  if (!instance || instance.status !== 'running') {
    return { success: false, error: 'Worker not running' };
  }

  instance.iframe.contentWindow?.postMessage({ type: 'DISPATCH_TRIGGER', trigger, data }, '*');
  return { success: true };
}

function forwardApiResponse(requestId: string, result: unknown, error?: string) {
  // Send the API response to all worker iframes — the sandbox will match by requestId
  for (const [, worker] of getAllWorkers()) {
    if (worker.status === 'running') {
      worker.iframe.contentWindow?.postMessage({ type: 'API_RESPONSE', requestId, result, error }, '*');
    }
  }
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
