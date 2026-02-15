/**
 * Sandboxed worker runtime.
 *
 * This page is loaded inside a sandboxed iframe embedded in the offscreen
 * document. Because sandbox pages are exempt from the extension CSP, we can
 * use `new Function()` here to execute user-provided worker code.
 *
 * Communication with the offscreen document (parent) happens exclusively via
 * `postMessage` / `message` events.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecWorkerMessage {
  type: 'EXEC_WORKER';
  code: string;
  extensionId: string;
  artifactId: string;
}

interface DispatchTriggerMessage {
  type: 'DISPATCH_TRIGGER';
  trigger: string;
  data: unknown;
}

interface ApiResponseMessage {
  type: 'API_RESPONSE';
  requestId: string;
  result: unknown;
  error?: string;
}

interface StopWorkerMessage {
  type: 'STOP_WORKER';
}

type InboundMessage = ExecWorkerMessage | DispatchTriggerMessage | ApiResponseMessage | StopWorkerMessage;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
const trackedTimers = new Set<ReturnType<typeof setTimeout>>();
const trackedIntervals = new Set<ReturnType<typeof setInterval>>();
const pendingApiCalls = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

let nextRequestId = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sendToParent = (msg: Record<string, unknown>) => {
  parent.postMessage(msg, '*');
};

const callApi = (method: string, args: unknown[]): Promise<unknown> => {
  const requestId = `wapi_${++nextRequestId}_${Date.now()}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingApiCalls.delete(requestId);
      reject(new Error(`API call timed out: ${method}`));
    }, 30_000);

    pendingApiCalls.set(requestId, {
      resolve: v => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: e => {
        clearTimeout(timer);
        reject(e);
      },
    });

    sendToParent({ type: 'API_CALL', requestId, method, args });
  });
};

const cleanup = () => {
  for (const t of trackedTimers) clearTimeout(t);
  trackedTimers.clear();
  for (const i of trackedIntervals) clearInterval(i);
  trackedIntervals.clear();
  handlers.clear();
  for (const [, pending] of pendingApiCalls) {
    pending.reject(new Error('Worker stopped'));
  }
  pendingApiCalls.clear();
};

// ---------------------------------------------------------------------------
// Conjure shim (equivalent to the old worker-shim.ts)
// ---------------------------------------------------------------------------

const createShim = (extensionId: string, artifactId: string) => {
  const trackedSetTimeout = (fn: (...args: unknown[]) => void, ms?: number): ReturnType<typeof setTimeout> => {
    const handle = setTimeout(() => {
      trackedTimers.delete(handle);
      fn();
    }, ms);
    trackedTimers.add(handle);
    return handle;
  };

  const trackedSetInterval = (fn: (...args: unknown[]) => void, ms?: number): ReturnType<typeof setInterval> => {
    const handle = setInterval(fn, ms);
    trackedIntervals.add(handle);
    return handle;
  };

  const trackedClearTimeout = (handle: ReturnType<typeof setTimeout>) => {
    clearTimeout(handle);
    trackedTimers.delete(handle);
  };

  const trackedClearInterval = (handle: ReturnType<typeof setInterval>) => {
    clearInterval(handle);
    trackedIntervals.delete(handle);
  };

  return {
    on(event: string, handler: (...args: unknown[]) => void) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },

    storage: {
      get(key: string) {
        return callApi('storage.get', [extensionId, key]);
      },
      set(key: string, value: unknown) {
        return callApi('storage.set', [extensionId, key, value]);
      },
      getAll() {
        return callApi('storage.getAll', [extensionId]);
      },
    },

    env: {
      get(key: string) {
        return callApi('env.get', [extensionId, key]);
      },
      getAll() {
        return callApi('env.getAll', [extensionId]);
      },
      set(key: string, value: string) {
        return callApi('env.set', [extensionId, key, value]);
      },
    },

    tabs: {
      query(info?: { active?: boolean; currentWindow?: boolean }) {
        return callApi('tabs.query', [info]);
      },
      sendMessage(tabId: number, message: unknown) {
        return callApi('tabs.sendMessage', [tabId, message]);
      },
    },

    messaging: {
      sendToContentScript(tabId: number, data: unknown) {
        return callApi('messaging.sendToContentScript', [tabId, data]);
      },
      broadcast(data: unknown) {
        return callApi('messaging.broadcast', [extensionId, data]);
      },
    },

    db: {
      createTables(tables: Record<string, string>) {
        return callApi('extdb.createTables', [extensionId, tables]);
      },
      removeTables(tableNames: string[]) {
        return callApi('extdb.removeTables', [extensionId, tableNames]);
      },
      getSchema() {
        return callApi('extdb.getSchema', [extensionId]);
      },
      put(table: string, data: Record<string, unknown>) {
        return callApi('extdb.query', [extensionId, { type: 'put', table, data }]);
      },
      add(table: string, data: Record<string, unknown>) {
        return callApi('extdb.query', [extensionId, { type: 'add', table, data }]);
      },
      get(table: string, key: string | number) {
        return callApi('extdb.query', [extensionId, { type: 'get', table, key }]);
      },
      getAll(table: string) {
        return callApi('extdb.query', [extensionId, { type: 'getAll', table }]);
      },
      update(table: string, key: string | number, changes: Record<string, unknown>) {
        return callApi('extdb.query', [extensionId, { type: 'update', table, key, changes }]);
      },
      delete(table: string, key: string | number) {
        return callApi('extdb.query', [extensionId, { type: 'delete', table, key }]);
      },
      where(table: string, index: string, value: unknown, limit?: number) {
        return callApi('extdb.query', [extensionId, { type: 'where', table, index, value, limit }]);
      },
      bulkPut(table: string, data: Record<string, unknown>[]) {
        return callApi('extdb.query', [extensionId, { type: 'bulkPut', table, data }]);
      },
      bulkDelete(table: string, keys: (string | number)[]) {
        return callApi('extdb.query', [extensionId, { type: 'bulkDelete', table, keys }]);
      },
      count(table: string) {
        return callApi('extdb.query', [extensionId, { type: 'count', table }]);
      },
      clear(table: string) {
        return callApi('extdb.query', [extensionId, { type: 'clear', table }]);
      },
    },

    extension: {
      id: extensionId,
      artifactId,
    },

    log(...args: unknown[]) {
      console.log(`[Conjure Worker:${extensionId}]`, ...args);
      sendToParent({
        type: 'WORKER_LOG',
        extensionId,
        level: 'log',
        args: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
      });
    },

    error(...args: unknown[]) {
      console.error(`[Conjure Worker:${extensionId}]`, ...args);
      sendToParent({
        type: 'WORKER_LOG',
        extensionId,
        level: 'error',
        args: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
      });
    },

    setTimeout: trackedSetTimeout,
    setInterval: trackedSetInterval,
    clearTimeout: trackedClearTimeout,
    clearInterval: trackedClearInterval,
  };
};

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

window.addEventListener('message', (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

  switch (msg.type) {
    case 'EXEC_WORKER': {
      cleanup();
      const shim = createShim(msg.extensionId, msg.artifactId);
      try {
        const workerFn = new Function('conjure', msg.code);
        workerFn(shim);
        sendToParent({ type: 'EXEC_RESULT', success: true });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendToParent({ type: 'EXEC_RESULT', success: false, error: errorMsg });
      }
      break;
    }

    case 'DISPATCH_TRIGGER': {
      const list = handlers.get(msg.trigger) ?? [];
      for (const handler of list) {
        try {
          handler(msg.data);
        } catch (err) {
          console.error(`[Conjure Sandbox] Trigger handler error (${msg.trigger}):`, err);
        }
      }
      break;
    }

    case 'API_RESPONSE': {
      const pending = pendingApiCalls.get(msg.requestId);
      if (!pending) break;
      pendingApiCalls.delete(msg.requestId);
      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.result);
      }
      break;
    }

    case 'STOP_WORKER': {
      cleanup();
      break;
    }
  }
});

console.log('[Conjure Sandbox Worker] Runtime loaded');
