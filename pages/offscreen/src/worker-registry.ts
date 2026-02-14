export interface WorkerInstance {
  extensionId: string;
  artifactId: string;
  status: 'running' | 'stopped' | 'error';
  error?: string;
  handlers: Map<string, Array<(...args: unknown[]) => void>>;
  timers: Set<ReturnType<typeof setTimeout>>;
  intervals: Set<ReturnType<typeof setInterval>>;
}

const workers = new Map<string, WorkerInstance>();

export function getWorker(extensionId: string): WorkerInstance | undefined {
  return workers.get(extensionId);
}

export function getAllWorkers(): Map<string, WorkerInstance> {
  return workers;
}

export function createWorkerInstance(extensionId: string, artifactId: string): WorkerInstance {
  const instance: WorkerInstance = {
    extensionId,
    artifactId,
    status: 'running',
    handlers: new Map(),
    timers: new Set(),
    intervals: new Set(),
  };
  workers.set(extensionId, instance);
  return instance;
}

export function stopWorkerInstance(extensionId: string): boolean {
  const instance = workers.get(extensionId);
  if (!instance) return false;

  // Clear all timers
  for (const timer of instance.timers) {
    clearTimeout(timer);
  }
  instance.timers.clear();

  // Clear all intervals
  for (const interval of instance.intervals) {
    clearInterval(interval);
  }
  instance.intervals.clear();

  // Clear all event handlers
  instance.handlers.clear();

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
