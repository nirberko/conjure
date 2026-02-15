import { ensureOffscreenDocument, closeOffscreenIfEmpty } from './offscreen-manager.js';
import { getArtifact, getArtifactsByExtension, getAllExtensions, extensionDBManager } from '@extension/shared';
import type { ExtDBOperation, WorkerLog } from '@extension/shared';

// Mirror of worker statuses from the offscreen document
const workerStatuses = new Map<string, { status: string; artifactId: string; error?: string }>();

// In-memory log buffer keyed by extensionId
const MAX_LOGS_PER_WORKER = 500;
const workerLogs = new Map<string, WorkerLog[]>();

export function pushWorkerLog(extensionId: string, level: 'log' | 'error', args: unknown[]): void {
  let logs = workerLogs.get(extensionId);
  if (!logs) {
    logs = [];
    workerLogs.set(extensionId, logs);
  }
  logs.push({ level, args, timestamp: Date.now() });
  if (logs.length > MAX_LOGS_PER_WORKER) {
    logs.splice(0, logs.length - MAX_LOGS_PER_WORKER);
  }
}

export function getWorkerLogs(extensionId: string): WorkerLog[] {
  return workerLogs.get(extensionId) ?? [];
}

export function clearWorkerLogs(extensionId: string): void {
  workerLogs.delete(extensionId);
}

async function sendToOffscreen(message: Record<string, unknown>): Promise<unknown> {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ target: 'offscreen', ...message });
}

export async function startBackgroundWorker(artifactId: string): Promise<{ success: boolean; error?: string }> {
  const artifact = await getArtifact(artifactId);
  if (!artifact || artifact.type !== 'background-worker') {
    return { success: false, error: 'Artifact not found or not a background-worker' };
  }

  const result = (await sendToOffscreen({
    action: 'START_WORKER',
    extensionId: artifact.extensionId,
    artifactId: artifact.id,
    code: artifact.code,
  })) as { success: boolean; error?: string };

  if (result.success) {
    workerStatuses.set(artifact.extensionId, { status: 'running', artifactId: artifact.id });
  }

  return result;
}

export async function stopBackgroundWorker(extensionId: string): Promise<{ success: boolean }> {
  const result = (await sendToOffscreen({
    action: 'STOP_WORKER',
    extensionId,
  })) as { success: boolean };

  workerStatuses.delete(extensionId);
  clearWorkerLogs(extensionId);

  // Close offscreen if no workers left
  if (workerStatuses.size === 0) {
    closeOffscreenIfEmpty().catch(() => {});
  }

  return result;
}

export async function reloadBackgroundWorker(artifactId: string): Promise<{ success: boolean; error?: string }> {
  const artifact = await getArtifact(artifactId);
  if (!artifact || artifact.type !== 'background-worker') {
    return { success: false, error: 'Artifact not found or not a background-worker' };
  }

  const result = (await sendToOffscreen({
    action: 'RELOAD_WORKER',
    extensionId: artifact.extensionId,
    artifactId: artifact.id,
    code: artifact.code,
  })) as { success: boolean; error?: string };

  if (result.success) {
    workerStatuses.set(artifact.extensionId, { status: 'running', artifactId: artifact.id });
  }

  return result;
}

export async function getAllWorkerStatuses(): Promise<
  Record<string, { status: string; artifactId: string; error?: string }>
> {
  // If local cache is empty, the service worker may have restarted — query offscreen
  if (workerStatuses.size === 0) {
    try {
      const resp = (await sendToOffscreen({ action: 'GET_STATUSES' })) as {
        statuses?: Record<string, { status: string; artifactId: string; error?: string }>;
      };
      if (resp?.statuses) {
        for (const [id, s] of Object.entries(resp.statuses)) {
          workerStatuses.set(id, s);
        }
      }
    } catch {
      // Offscreen document may not exist
    }
  }

  const statuses: Record<string, { status: string; artifactId: string; error?: string }> = {};
  for (const [extId, status] of workerStatuses) {
    statuses[extId] = status;
  }
  return statuses;
}

export function dispatchWorkerTrigger(extensionId: string, trigger: string, data: unknown): void {
  if (!workerStatuses.has(extensionId)) return;

  sendToOffscreen({
    action: 'DISPATCH_TRIGGER',
    extensionId,
    trigger,
    data,
  }).catch(err => {
    console.warn(`[Conjure] Failed to dispatch trigger ${trigger} to worker ${extensionId}:`, err);
  });
}

export function broadcastStorageChange(extensionId: string, changes: unknown): void {
  if (!workerStatuses.has(extensionId)) return;

  sendToOffscreen({
    action: 'BROADCAST_STORAGE_CHANGE',
    extensionId,
    changes,
  }).catch(err => {
    console.warn('[Conjure] Failed to broadcast storage change:', err);
  });
}

export function handleWorkerStatusUpdate(extensionId: string, status: string, error?: string): void {
  if (status === 'stopped' || status === 'not_found') {
    workerStatuses.delete(extensionId);
  } else {
    const existing = workerStatuses.get(extensionId);
    if (existing) {
      existing.status = status;
      existing.error = error;
    } else {
      // Worker may have been started before service worker restarted
      workerStatuses.set(extensionId, { status, artifactId: '', error });
    }
  }
}

export async function handleWorkerApiCall(requestId: string, method: string, args: unknown[]): Promise<void> {
  let result: unknown;
  let error: string | undefined;

  try {
    switch (method) {
      case 'storage.get': {
        const [extensionId, key] = args as [string, string];
        result = await extensionDBManager.storageGet(extensionId, key);
        break;
      }
      case 'storage.set': {
        const [extensionId, key, value] = args as [string, string, Record<string, unknown>];
        const storageData = typeof value === 'object' && value !== null ? value : { value };
        await extensionDBManager.storageSet(extensionId, key, storageData);
        broadcastStorageChange(extensionId, { key, data: storageData });
        result = { success: true };
        break;
      }
      case 'storage.getAll': {
        // Return empty for now — getAll isn't trivially supported by current storage model
        result = {};
        break;
      }
      case 'tabs.query': {
        const [queryInfo] = args as [chrome.tabs.QueryInfo | undefined];
        result = await chrome.tabs.query(queryInfo ?? {});
        break;
      }
      case 'tabs.sendMessage': {
        const [tabId, message] = args as [number, unknown];
        result = await chrome.tabs.sendMessage(tabId, message);
        break;
      }
      case 'messaging.sendToContentScript': {
        const [tabId, data] = args as [number, unknown];
        result = await chrome.tabs.sendMessage(tabId, {
          type: 'WORKER_MESSAGE',
          payload: data,
        });
        break;
      }
      case 'messaging.broadcast': {
        const [extensionId, data] = args as [string, unknown];
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: 'WORKER_MESSAGE',
                payload: { extensionId, data },
              })
              .catch(() => {});
          }
        }
        result = { success: true, tabCount: tabs.length };
        break;
      }
      case 'env.get': {
        const [extensionId, key] = args as [string, string];
        const envData = ((await extensionDBManager.storageGet(extensionId, '_env')) ?? {}) as Record<string, string>;
        result = envData[key] ?? null;
        break;
      }
      case 'env.getAll': {
        const [extensionId] = args as [string];
        result = ((await extensionDBManager.storageGet(extensionId, '_env')) ?? {}) as Record<string, string>;
        break;
      }
      case 'env.set': {
        const [extensionId, key, value] = args as [string, string, string];
        const envData = ((await extensionDBManager.storageGet(extensionId, '_env')) ?? {}) as Record<string, string>;
        envData[key] = value;
        await extensionDBManager.storageSet(extensionId, '_env', envData);
        result = { success: true };
        break;
      }
      case 'extdb.createTables': {
        const [extensionId, tables] = args as [string, Record<string, string>];
        result = await extensionDBManager.createTables(extensionId, tables);
        break;
      }
      case 'extdb.removeTables': {
        const [extensionId, tableNames] = args as [string, string[]];
        result = await extensionDBManager.removeTables(extensionId, tableNames);
        break;
      }
      case 'extdb.query': {
        const [extensionId, operation] = args as [string, ExtDBOperation];
        result = await extensionDBManager.query(extensionId, operation);
        break;
      }
      case 'extdb.getSchema': {
        const [extensionId] = args as [string];
        result = await extensionDBManager.getSchema(extensionId);
        break;
      }
      default:
        error = `Unknown API method: ${method}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // Send response back to offscreen document
  chrome.runtime
    .sendMessage({
      target: 'offscreen',
      action: 'WORKER_API_RESPONSE',
      requestId,
      result,
      error,
    })
    .catch(() => {});
}

export async function autoStartBackgroundWorkers(): Promise<void> {
  const extensions = await getAllExtensions();
  const enabledExtensions = extensions.filter(e => e.enabled);

  for (const ext of enabledExtensions) {
    const artifacts = await getArtifactsByExtension(ext.id);
    const workerArtifact = artifacts.find(a => a.type === 'background-worker' && a.enabled);
    if (workerArtifact) {
      console.log(`[Conjure] Auto-starting background worker for extension: ${ext.name}`);
      startBackgroundWorker(workerArtifact.id).catch(err => {
        console.error(`[Conjure] Failed to auto-start worker for ${ext.name}:`, err);
      });
    }
  }
}
