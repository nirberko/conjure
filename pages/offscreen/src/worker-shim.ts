import type { WorkerInstance } from './worker-registry.js';

let nextRequestId = 0;
const pendingApiCalls = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

export function resolveApiCall(requestId: string, result: unknown, error?: string) {
  const pending = pendingApiCalls.get(requestId);
  if (!pending) return;
  pendingApiCalls.delete(requestId);
  if (error) {
    pending.reject(new Error(error));
  } else {
    pending.resolve(result);
  }
}

function callServiceWorkerApi(method: string, args: unknown[]): Promise<unknown> {
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

    chrome.runtime
      .sendMessage({
        target: 'service-worker',
        action: 'WORKER_API_CALL',
        requestId,
        method,
        args,
      })
      .catch(err => {
        clearTimeout(timer);
        pendingApiCalls.delete(requestId);
        reject(err);
      });
  });
}

export function createWorkerShim(instance: WorkerInstance) {
  // Wrapped setTimeout that tracks handles for cleanup
  function trackedSetTimeout(fn: (...args: unknown[]) => void, ms?: number): ReturnType<typeof setTimeout> {
    const handle = setTimeout(() => {
      instance.timers.delete(handle);
      fn();
    }, ms);
    instance.timers.add(handle);
    return handle;
  }

  function trackedSetInterval(fn: (...args: unknown[]) => void, ms?: number): ReturnType<typeof setInterval> {
    const handle = setInterval(fn, ms);
    instance.intervals.add(handle);
    return handle;
  }

  function trackedClearTimeout(handle: ReturnType<typeof setTimeout>) {
    clearTimeout(handle);
    instance.timers.delete(handle);
  }

  function trackedClearInterval(handle: ReturnType<typeof setInterval>) {
    clearInterval(handle);
    instance.intervals.delete(handle);
  }

  const shim = {
    on(event: string, handler: (...args: unknown[]) => void) {
      const handlers = instance.handlers.get(event) ?? [];
      handlers.push(handler);
      instance.handlers.set(event, handlers);
    },

    storage: {
      get(key: string) {
        return callServiceWorkerApi('storage.get', [instance.extensionId, key]);
      },
      set(key: string, value: unknown) {
        return callServiceWorkerApi('storage.set', [instance.extensionId, key, value]);
      },
      getAll() {
        return callServiceWorkerApi('storage.getAll', [instance.extensionId]);
      },
    },

    tabs: {
      query(info?: { active?: boolean; currentWindow?: boolean }) {
        return callServiceWorkerApi('tabs.query', [info]);
      },
      sendMessage(tabId: number, message: unknown) {
        return callServiceWorkerApi('tabs.sendMessage', [tabId, message]);
      },
    },

    messaging: {
      sendToContentScript(tabId: number, data: unknown) {
        return callServiceWorkerApi('messaging.sendToContentScript', [tabId, data]);
      },
      broadcast(data: unknown) {
        return callServiceWorkerApi('messaging.broadcast', [instance.extensionId, data]);
      },
    },

    db: {
      createTables(tables: Record<string, string>) {
        return callServiceWorkerApi('extdb.createTables', [instance.extensionId, tables]);
      },
      removeTables(tableNames: string[]) {
        return callServiceWorkerApi('extdb.removeTables', [instance.extensionId, tableNames]);
      },
      getSchema() {
        return callServiceWorkerApi('extdb.getSchema', [instance.extensionId]);
      },
      put(table: string, data: Record<string, unknown>) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'put', table, data }]);
      },
      add(table: string, data: Record<string, unknown>) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'add', table, data }]);
      },
      get(table: string, key: string | number) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'get', table, key }]);
      },
      getAll(table: string) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'getAll', table }]);
      },
      update(table: string, key: string | number, changes: Record<string, unknown>) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'update', table, key, changes }]);
      },
      delete(table: string, key: string | number) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'delete', table, key }]);
      },
      where(table: string, index: string, value: unknown, limit?: number) {
        return callServiceWorkerApi('extdb.query', [
          instance.extensionId,
          { type: 'where', table, index, value, limit },
        ]);
      },
      bulkPut(table: string, data: Record<string, unknown>[]) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'bulkPut', table, data }]);
      },
      bulkDelete(table: string, keys: (string | number)[]) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'bulkDelete', table, keys }]);
      },
      count(table: string) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'count', table }]);
      },
      clear(table: string) {
        return callServiceWorkerApi('extdb.query', [instance.extensionId, { type: 'clear', table }]);
      },
    },

    extension: {
      id: instance.extensionId,
      artifactId: instance.artifactId,
    },

    log(...args: unknown[]) {
      console.log(`[WebForge Worker:${instance.extensionId}]`, ...args);
      chrome.runtime
        .sendMessage({
          target: 'service-worker',
          action: 'WORKER_LOG',
          extensionId: instance.extensionId,
          level: 'log',
          args: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
        })
        .catch(() => {});
    },

    error(...args: unknown[]) {
      console.error(`[WebForge Worker:${instance.extensionId}]`, ...args);
      chrome.runtime
        .sendMessage({
          target: 'service-worker',
          action: 'WORKER_LOG',
          extensionId: instance.extensionId,
          level: 'error',
          args: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
        })
        .catch(() => {});
    },

    // Expose tracked timer functions
    setTimeout: trackedSetTimeout,
    setInterval: trackedSetInterval,
    clearTimeout: trackedClearTimeout,
    clearInterval: trackedClearInterval,
  };

  return shim;
}
