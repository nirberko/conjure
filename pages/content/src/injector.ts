import type { Artifact } from '@extension/shared';

const injectedArtifacts = new Map<string, { element: HTMLElement; cleanup: () => void }>();
const pendingInjections = new Set<string>();
let runtimePromise: Promise<void> | null = null;

async function injectReactRuntime(): Promise<void> {
  if (!runtimePromise) {
    runtimePromise = chrome.runtime.sendMessage({ type: 'INJECT_REACT_RUNTIME' });
  }
  await runtimePromise;
}

// --- Artifact Injection System ---

export async function injectArtifact(artifact: Artifact): Promise<{ success: boolean; error?: string }> {
  switch (artifact.type) {
    case 'react-component':
      return injectReactArtifact(artifact);
    case 'js-script':
      return injectScript(artifact);
    case 'css':
      return injectCSS(artifact);
    default:
      return { success: false, error: `Unknown artifact type: ${artifact.type}` };
  }
}

async function injectReactArtifact(artifact: Artifact): Promise<{ success: boolean; error?: string }> {
  if (pendingInjections.has(artifact.id)) return { success: false, error: 'Already injecting' };

  removeArtifact(artifact.id);
  pendingInjections.add(artifact.id);

  try {
    if (!artifact.cssSelector) {
      return { success: false, error: 'React component requires a cssSelector' };
    }

    const targetEl = document.querySelector(artifact.cssSelector);
    if (!targetEl) {
      return { success: false, error: `Target element not found: ${artifact.cssSelector}` };
    }

    await injectReactRuntime();

    const host = document.createElement('webforge-component');
    host.dataset.artifactId = artifact.id;
    host.style.cssText = 'display:block;';

    const mountId = `webforge-mount-${artifact.id}`;
    const mount = document.createElement('div');
    mount.id = mountId;
    host.appendChild(mount);

    const mode = artifact.injectionMode ?? 'append';
    switch (mode) {
      case 'append':
        targetEl.appendChild(host);
        break;
      case 'prepend':
        targetEl.prepend(host);
        break;
      case 'after':
        targetEl.after(host);
        break;
      case 'before':
        targetEl.before(host);
        break;
    }

    const sendWorkerMessageHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.extensionId !== artifact.extensionId) return;

      chrome.runtime.sendMessage({
        type: 'WORKER_CUSTOM_MESSAGE',
        payload: { extensionId: artifact.extensionId, data: detail.data },
      });
    };

    const extDbHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.extensionId !== artifact.extensionId) return;

      const { action, payload, requestId } = detail as {
        action: string;
        payload: Record<string, unknown>;
        requestId: string;
      };

      let messageType: string;
      let messagePayload: Record<string, unknown>;

      switch (action) {
        case 'createTables':
          messageType = 'EXT_DB_CREATE_TABLES';
          messagePayload = { extensionId: artifact.extensionId, tables: payload.tables };
          break;
        case 'removeTables':
          messageType = 'EXT_DB_REMOVE_TABLES';
          messagePayload = { extensionId: artifact.extensionId, tableNames: payload.tableNames };
          break;
        case 'query':
          messageType = 'EXT_DB_QUERY';
          messagePayload = { extensionId: artifact.extensionId, operation: payload.operation };
          break;
        case 'getSchema':
          messageType = 'EXT_DB_GET_SCHEMA';
          messagePayload = { extensionId: artifact.extensionId };
          break;
        case 'storageGet':
          messageType = 'EXT_DB_STORAGE_GET';
          messagePayload = { extensionId: artifact.extensionId, key: payload.key as string };
          break;
        case 'storageSet':
          messageType = 'EXT_DB_STORAGE_SET';
          messagePayload = { extensionId: artifact.extensionId, key: payload.key as string, data: payload.data };
          break;
        default:
          window.dispatchEvent(
            new CustomEvent(`webforge-ext-db-${requestId}`, {
              detail: { error: `Unknown db action: ${action}` },
            }),
          );
          return;
      }

      chrome.runtime.sendMessage({ type: messageType, payload: messagePayload }, response => {
        window.dispatchEvent(
          new CustomEvent(`webforge-ext-db-${requestId}`, {
            detail: {
              result: response?.result ?? response?.schema ?? response?.data ?? response,
              error: response?.error,
            },
          }),
        );
      });
    };

    window.addEventListener('webforge-send-worker-message', sendWorkerMessageHandler);
    window.addEventListener('webforge-ext-db', extDbHandler);

    await chrome.runtime.sendMessage({
      type: 'EXECUTE_IN_PAGE',
      payload: { code: artifact.code, mountId, componentId: artifact.id, extensionId: artifact.extensionId },
    });

    const cleanup = () => {
      window.removeEventListener('webforge-send-worker-message', sendWorkerMessageHandler);
      window.removeEventListener('webforge-ext-db', extDbHandler);
    };

    injectedArtifacts.set(artifact.id, { element: host, cleanup });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  } finally {
    pendingInjections.delete(artifact.id);
  }
}

async function injectScript(artifact: Artifact): Promise<{ success: boolean; error?: string }> {
  removeArtifact(artifact.id);

  try {
    // Wrap in IIFE and inject via a <script> tag in the page
    const wrappedCode = `(function() {\n${artifact.code}\n})();`;
    const script = document.createElement('script');
    script.dataset.artifactId = artifact.id;
    script.textContent = wrappedCode;
    (document.head || document.documentElement).appendChild(script);

    const cleanup = () => {};
    injectedArtifacts.set(artifact.id, { element: script, cleanup });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function injectCSS(artifact: Artifact): Promise<{ success: boolean; error?: string }> {
  removeArtifact(artifact.id);

  try {
    const style = document.createElement('style');
    style.dataset.artifactId = artifact.id;
    style.textContent = artifact.code;
    (document.head || document.documentElement).appendChild(style);

    const cleanup = () => {};
    injectedArtifacts.set(artifact.id, { element: style, cleanup });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function removeArtifact(artifactId: string) {
  const entry = injectedArtifacts.get(artifactId);
  if (entry) {
    entry.cleanup();
    entry.element.remove();
    injectedArtifacts.delete(artifactId);
  }
}

export function isArtifactInjected(artifactId: string): boolean {
  return injectedArtifacts.has(artifactId);
}
