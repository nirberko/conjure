import type { Artifact } from '@extension/shared';

const injectedArtifacts = new Map<string, { elements: HTMLElement[]; cleanup: () => void }>();
const pendingInjections = new Set<string>();
let runtimePromise: Promise<void> | null = null;

const injectReactRuntime = async (): Promise<void> => {
  if (!runtimePromise) {
    runtimePromise = chrome.runtime.sendMessage({ type: 'INJECT_REACT_RUNTIME' });
  }
  await runtimePromise;
};

const evaluateXPath = (xpath: string): Element[] => {
  const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const elements: Element[] = [];
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (node instanceof Element) elements.push(node);
  }
  return elements;
};

// --- Artifact Injection System ---

const injectArtifact = async (artifact: Artifact): Promise<{ success: boolean; error?: string }> => {
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
};

const injectReactArtifact = async (artifact: Artifact): Promise<{ success: boolean; error?: string }> => {
  if (pendingInjections.has(artifact.id)) return { success: false, error: 'Already injecting' };

  removeArtifact(artifact.id);
  pendingInjections.add(artifact.id);

  try {
    await injectReactRuntime();

    const hasDeps = artifact.dependencies && Object.keys(artifact.dependencies).length > 0;

    // Determine target elements: XPath expression or document.body
    const targets = artifact.elementXPath ? evaluateXPath(artifact.elementXPath) : [document.body];

    if (artifact.elementXPath && targets.length === 0) {
      return { success: false, error: `No elements found for XPath: ${artifact.elementXPath}` };
    }

    const hosts: HTMLElement[] = [];

    for (let i = 0; i < targets.length; i++) {
      const host = document.createElement('conjure-component');
      host.dataset.artifactId = artifact.id;
      host.style.cssText = 'display:block;';

      const mountId = `conjure-mount-${artifact.id}-${i}`;
      const mount = document.createElement('div');
      mount.id = mountId;
      host.appendChild(mount);

      targets[i].appendChild(host);
      hosts.push(host);
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
            new CustomEvent(`conjure-ext-db-${requestId}`, {
              detail: { error: `Unknown db action: ${action}` },
            }),
          );
          return;
      }

      chrome.runtime.sendMessage({ type: messageType, payload: messagePayload }, response => {
        window.dispatchEvent(
          new CustomEvent(`conjure-ext-db-${requestId}`, {
            detail: {
              result: response?.result ?? response?.schema ?? response?.data ?? response,
              error: response?.error,
            },
          }),
        );
      });
    };

    window.addEventListener('conjure-send-worker-message', sendWorkerMessageHandler);
    window.addEventListener('conjure-ext-db', extDbHandler);

    // Execute component code for each mount point
    for (let i = 0; i < hosts.length; i++) {
      const mountId = `conjure-mount-${artifact.id}-${i}`;

      if (hasDeps) {
        // Module path: use import map + <script type="module">
        await chrome.runtime.sendMessage({
          type: 'EXECUTE_MODULE_IN_PAGE',
          payload: {
            code: artifact.code,
            mountId,
            componentId: artifact.id,
            extensionId: artifact.extensionId,
            dependencies: artifact.dependencies,
          },
        });
      } else {
        // Legacy path: use new Function() (no dependencies)
        await chrome.runtime.sendMessage({
          type: 'EXECUTE_IN_PAGE',
          payload: { code: artifact.code, mountId, componentId: artifact.id, extensionId: artifact.extensionId },
        });
      }
    }

    const cleanup = () => {
      window.removeEventListener('conjure-send-worker-message', sendWorkerMessageHandler);
      window.removeEventListener('conjure-ext-db', extDbHandler);
    };

    injectedArtifacts.set(artifact.id, { elements: hosts, cleanup });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  } finally {
    pendingInjections.delete(artifact.id);
  }
};

const injectScript = async (artifact: Artifact): Promise<{ success: boolean; error?: string }> => {
  removeArtifact(artifact.id);

  try {
    // Wrap in IIFE and inject via a <script> tag in the page
    const wrappedCode = `(function() {\n${artifact.code}\n})();`;
    const script = document.createElement('script');
    script.dataset.artifactId = artifact.id;
    script.textContent = wrappedCode;
    (document.head || document.documentElement).appendChild(script);

    const cleanup = () => {};
    injectedArtifacts.set(artifact.id, { elements: [script], cleanup });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

const injectCSS = async (artifact: Artifact): Promise<{ success: boolean; error?: string }> => {
  removeArtifact(artifact.id);

  try {
    const style = document.createElement('style');
    style.dataset.artifactId = artifact.id;
    style.textContent = artifact.code;
    (document.head || document.documentElement).appendChild(style);

    const cleanup = () => {};
    injectedArtifacts.set(artifact.id, { elements: [style], cleanup });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

const removeArtifact = (artifactId: string) => {
  const entry = injectedArtifacts.get(artifactId);
  if (entry) {
    entry.cleanup();
    entry.elements.forEach(el => el.remove());
    injectedArtifacts.delete(artifactId);
  }
};

const isArtifactInjected = (artifactId: string): boolean => injectedArtifacts.has(artifactId);

const injectArtifactsBatch = async (artifacts: Artifact[]): Promise<void> => {
  for (const artifact of artifacts) {
    await injectArtifact(artifact);
  }
};

export { injectArtifact, injectArtifactsBatch, removeArtifact, isArtifactInjected };
