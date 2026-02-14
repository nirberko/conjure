export interface WorkerInstance {
  extensionId: string;
  artifactId: string;
  status: 'running' | 'stopped' | 'error';
  error?: string;
  iframe: HTMLIFrameElement;
}

const workers = new Map<string, WorkerInstance>();

export function getWorker(extensionId: string): WorkerInstance | undefined {
  return workers.get(extensionId);
}

export function getAllWorkers(): Map<string, WorkerInstance> {
  return workers;
}

export function createWorkerInstance(extensionId: string, artifactId: string, iframe: HTMLIFrameElement): WorkerInstance {
  const instance: WorkerInstance = {
    extensionId,
    artifactId,
    status: 'running',
    iframe,
  };
  workers.set(extensionId, instance);
  return instance;
}

export function stopWorkerInstance(extensionId: string): boolean {
  const instance = workers.get(extensionId);
  if (!instance) return false;

  // Tell the sandbox to clean up its timers/handlers
  instance.iframe.contentWindow?.postMessage({ type: 'STOP_WORKER' }, '*');

  // Remove iframe from DOM
  instance.iframe.remove();

  instance.status = 'stopped';
  workers.delete(extensionId);
  return true;
}

export function getWorkerStatuses(): Record<string, { status: string; artifactId: string; error?: string }> {
  const statuses: Record<string, { status: string; artifactId: string; error?: string }> = {};
  for (const [extId, instance] of workers) {
    statuses[extId] = {
      status: instance.status,
      artifactId: instance.artifactId,
      ...(instance.error ? { error: instance.error } : {}),
    };
  }
  return statuses;
}
