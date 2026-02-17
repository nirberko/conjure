import { runAgent, stopAgent, getAgentStatus } from './agent-runner.js';
import { getMatchingExtensionArtifacts } from './url-matcher.js';
import {
  startBackgroundWorker,
  stopBackgroundWorker,
  reloadBackgroundWorker,
  getAllWorkerStatuses,
  handleWorkerApiCall,
  handleWorkerStatusUpdate,
  autoStartBackgroundWorkers,
  broadcastStorageChange,
  dispatchWorkerTrigger,
  pushWorkerLog,
  getWorkerLogs,
  clearWorkerLogs,
} from './worker-manager.js';
import {
  migrateV1ToV2,
  getSetting,
  setSetting,
  getAllExtensions,
  createExtension,
  updateExtension,
  deleteExtension,
  getArtifactsByExtension,
  extensionDBManager,
  db,
  REACT_VERSION,
} from '@extension/shared';
import { transform } from 'sucrase';
import type { Extension, AIProvider, ExtDBOperation } from '@extension/shared';
import type { Table } from 'dexie';

console.log('[Conjure] Background service worker loaded');

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Run migration on startup
migrateV1ToV2().catch(err => console.error('[Conjure] Migration error:', err));

// Auto-start background workers for enabled extensions
autoStartBackgroundWorkers().catch(err => console.error('[Conjure] Auto-start workers error:', err));

// Message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Target-based routing: messages from the offscreen document
  if (message.target === 'service-worker') {
    const handler = async () => {
      switch (message.action) {
        case 'WORKER_API_CALL':
          await handleWorkerApiCall(message.requestId, message.method, message.args);
          return { success: true };

        case 'WORKER_STATUS_UPDATE':
          handleWorkerStatusUpdate(message.extensionId, message.status, message.error);
          return { success: true };

        case 'WORKER_LOG':
          pushWorkerLog(message.extensionId, message.level ?? 'log', message.args ?? []);
          if (message.level === 'error') {
            console.error(`[Worker:${message.extensionId}]`, ...(message.args ?? []));
          } else {
            console.log(`[Worker:${message.extensionId}]`, ...(message.args ?? []));
          }
          return { success: true };

        case 'OFFSCREEN_READY':
          console.log('[Conjure] Offscreen document ready');
          return { success: true };

        default:
          return { error: `Unknown service-worker action: ${message.action}` };
      }
    };

    handler()
      .then(sendResponse)
      .catch(err => {
        console.error('[Conjure] Service-worker handler error:', err);
        sendResponse({ error: err.message });
      });
    return true;
  }

  console.log('[Conjure] Message received:', message.type, message.payload);
  const handler = async () => {
    switch (message.type) {
      // --- Settings ---

      case 'GET_SETTINGS': {
        const { key } = message.payload as { key: string };
        const value = await getSetting(key);
        return { value };
      }

      case 'SET_SETTINGS': {
        const { key, value } = message.payload as { key: string; value: unknown };
        await setSetting(key, value);
        return { success: true };
      }

      case 'INJECT_REACT_RUNTIME': {
        const tabId = sender.tab?.id;
        if (tabId) {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/react-runtime.iife.js'],
            world: 'MAIN',
          });
        }
        return { success: true };
      }

      case 'EXECUTE_IN_PAGE': {
        const tabId = sender.tab?.id;
        const {
          code,
          mountId,
          componentId,
          extensionId: extId,
        } = message.payload as {
          code: string;
          mountId: string;
          componentId: string;
          extensionId?: string;
        };
        if (tabId) {
          const tab = await chrome.tabs.get(tabId);
          const pageUrl = tab.url || '';

          let transformedCode = code;
          try {
            transformedCode = transform(code, { transforms: ['jsx'] }).code;
          } catch {
            // Code may already be plain JS
          }

          // Auto-append return if missing
          const trimmed = transformedCode.trim();
          if (!trimmed.match(/return\s+\w+\s*;?\s*$/)) {
            const fnMatch = trimmed.match(/function\s+([A-Z]\w*)\s*\(/);
            if (fnMatch) {
              transformedCode = transformedCode + '\nreturn ' + fnMatch[1] + ';';
            }
          }

          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: async (componentCode: string, mId: string, cId: string, pUrl: string, eId: string) => {
              // Wait for React runtime to be available (executeScript may resolve before the IIFE runs)
              let _WF: Record<string, unknown> | undefined;
              for (let i = 0; i < 50; i++) {
                _WF = (window as unknown as Record<string, unknown>).__CONJURE__ as Record<string, unknown> | undefined;
                if (_WF) break;
                await new Promise(r => setTimeout(r, 50));
              }
              if (!_WF) {
                console.error('[Conjure] React runtime not loaded');
                const mountEl = document.getElementById(mId);
                if (mountEl) {
                  mountEl.innerHTML =
                    '<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: React runtime failed to load. Try reloading the page.</div>';
                }
                return;
              }

              // Helper: build context code string for embedding in script element
              const buildContextCode = (): string =>
                [
                  'var _WF = window.__CONJURE__;',
                  'var React = _WF.React;',
                  'var ReactDOM = _WF.ReactDOM;',
                  'var _nextReqId = 0;',
                  'var _cId = ' + JSON.stringify(cId) + ';',
                  'var _pUrl = ' + JSON.stringify(pUrl) + ';',
                  'var _eId = ' + JSON.stringify(eId) + ';',
                  'function sendMessage(data) {',
                  '  window.dispatchEvent(new CustomEvent("conjure-send-worker-message", {',
                  '    detail: { extensionId: _eId, data: data }',
                  '  }));',
                  '}',
                  'function onWorkerMessage(callback) {',
                  '  function handler(e) {',
                  '    if (e.detail && e.detail.extensionId !== _eId) return;',
                  '    callback(e.detail.data);',
                  '  }',
                  '  window.addEventListener("conjure-worker-message", handler);',
                  '  return function() { window.removeEventListener("conjure-worker-message", handler); };',
                  '}',
                  'function extDbCall(action, payload) {',
                  '  return new Promise(function(resolve, reject) {',
                  '    var reqId = "db" + (++_nextReqId) + "_" + Date.now();',
                  '    function handler(e) {',
                  '      window.removeEventListener("conjure-ext-db-" + reqId, handler);',
                  '      if (e.detail.error) reject(new Error(e.detail.error));',
                  '      else resolve(e.detail.result);',
                  '    }',
                  '    window.addEventListener("conjure-ext-db-" + reqId, handler);',
                  '    window.dispatchEvent(new CustomEvent("conjure-ext-db", {',
                  '      detail: { extensionId: _eId, action: action, payload: payload, requestId: reqId }',
                  '    }));',
                  '  });',
                  '}',
                  'function getData() { return extDbCall("storageGet", { key: _cId + ":" + _pUrl }); }',
                  'function setData(data) { return extDbCall("storageSet", { key: _cId + ":" + _pUrl, data: data }); }',
                  'var db = {',
                  '  createTables: function(tables) { return extDbCall("createTables", { tables: tables }); },',
                  '  removeTables: function(tableNames) { return extDbCall("removeTables", { tableNames: tableNames }); },',
                  '  getSchema: function() { return extDbCall("getSchema", {}); },',
                  '  put: function(table, data) { return extDbCall("query", { operation: { type: "put", table: table, data: data } }); },',
                  '  add: function(table, data) { return extDbCall("query", { operation: { type: "add", table: table, data: data } }); },',
                  '  get: function(table, key) { return extDbCall("query", { operation: { type: "get", table: table, key: key } }); },',
                  '  getAll: function(table) { return extDbCall("query", { operation: { type: "getAll", table: table } }); },',
                  '  update: function(table, key, changes) { return extDbCall("query", { operation: { type: "update", table: table, key: key, changes: changes } }); },',
                  '  delete: function(table, key) { return extDbCall("query", { operation: { type: "delete", table: table, key: key } }); },',
                  '  where: function(table, index, value, limit) { return extDbCall("query", { operation: { type: "where", table: table, index: index, value: value, limit: limit } }); },',
                  '  bulkPut: function(table, data) { return extDbCall("query", { operation: { type: "bulkPut", table: table, data: data } }); },',
                  '  bulkDelete: function(table, keys) { return extDbCall("query", { operation: { type: "bulkDelete", table: table, keys: keys } }); },',
                  '  count: function(table) { return extDbCall("query", { operation: { type: "count", table: table } }); },',
                  '  clear: function(table) { return extDbCall("query", { operation: { type: "clear", table: table } }); }',
                  '};',
                  'var env = {',
                  '  get: function(key) { return extDbCall("storageGet", { key: "_env" }).then(function(d) { return (d && d[key]) || null; }); },',
                  '  getAll: function() { return extDbCall("storageGet", { key: "_env" }).then(function(d) { return d || {}; }); }',
                  '};',
                  'var context = { getData: getData, setData: setData, pageUrl: ' +
                    JSON.stringify(pUrl) +
                    ', sendMessage: sendMessage, onWorkerMessage: onWorkerMessage, db: db, env: env };',
                ].join('\n');

              // Primary: try new Function (works on most sites)
              try {
                const React = _WF.React;
                const ReactDOM = _WF.ReactDOM;

                let _nextReqId = 0;

                const extDbCall = (action: string, payload: Record<string, unknown>): Promise<unknown> =>
                  new Promise((resolve, reject) => {
                    const reqId = 'db' + ++_nextReqId + '_' + Date.now();
                    const handler = (e: Event) => {
                      window.removeEventListener('conjure-ext-db-' + reqId, handler);
                      const d = (e as CustomEvent).detail;
                      if (d.error) reject(new Error(d.error));
                      else resolve(d.result);
                    };
                    window.addEventListener('conjure-ext-db-' + reqId, handler);
                    window.dispatchEvent(
                      new CustomEvent('conjure-ext-db', {
                        detail: { extensionId: eId, action, payload, requestId: reqId },
                      }),
                    );
                  });

                const getData = (): Promise<Record<string, unknown>> =>
                  extDbCall('storageGet', { key: cId + ':' + pUrl }) as Promise<Record<string, unknown>>;

                const setData = (data: Record<string, unknown>): Promise<void> =>
                  extDbCall('storageSet', { key: cId + ':' + pUrl, data }) as Promise<void>;

                const sendMessage = (data: unknown): void => {
                  window.dispatchEvent(
                    new CustomEvent('conjure-send-worker-message', {
                      detail: { extensionId: eId, data },
                    }),
                  );
                };

                const onWorkerMessage = (callback: (data: unknown) => void): (() => void) => {
                  const handler = (e: Event) => {
                    const detail = (e as CustomEvent).detail;
                    if (detail?.extensionId !== eId) return;
                    callback(detail.data);
                  };
                  window.addEventListener('conjure-worker-message', handler);
                  return () => window.removeEventListener('conjure-worker-message', handler);
                };

                const db = {
                  createTables: (tables: Record<string, string>) => extDbCall('createTables', { tables }),
                  removeTables: (tableNames: string[]) => extDbCall('removeTables', { tableNames }),
                  getSchema: () => extDbCall('getSchema', {}),
                  put: (table: string, data: Record<string, unknown>) =>
                    extDbCall('query', { operation: { type: 'put', table, data } }),
                  add: (table: string, data: Record<string, unknown>) =>
                    extDbCall('query', { operation: { type: 'add', table, data } }),
                  get: (table: string, key: string | number) =>
                    extDbCall('query', { operation: { type: 'get', table, key } }),
                  getAll: (table: string) => extDbCall('query', { operation: { type: 'getAll', table } }),
                  update: (table: string, key: string | number, changes: Record<string, unknown>) =>
                    extDbCall('query', { operation: { type: 'update', table, key, changes } }),
                  delete: (table: string, key: string | number) =>
                    extDbCall('query', { operation: { type: 'delete', table, key } }),
                  where: (table: string, index: string, value: unknown, limit?: number) =>
                    extDbCall('query', { operation: { type: 'where', table, index, value, limit } }),
                  bulkPut: (table: string, data: Record<string, unknown>[]) =>
                    extDbCall('query', { operation: { type: 'bulkPut', table, data } }),
                  bulkDelete: (table: string, keys: (string | number)[]) =>
                    extDbCall('query', { operation: { type: 'bulkDelete', table, keys } }),
                  count: (table: string) => extDbCall('query', { operation: { type: 'count', table } }),
                  clear: (table: string) => extDbCall('query', { operation: { type: 'clear', table } }),
                };

                const env = {
                  async get(key: string): Promise<string | null> {
                    const envData = ((await extDbCall('storageGet', { key: '_env' })) ?? {}) as Record<string, string>;
                    return envData[key] ?? null;
                  },
                  async getAll(): Promise<Record<string, string>> {
                    return ((await extDbCall('storageGet', { key: '_env' })) ?? {}) as Record<string, string>;
                  },
                };

                const context = { getData, setData, pageUrl: pUrl, sendMessage, onWorkerMessage, db, env };
                const componentFn = new Function('React', 'ReactDOM', 'context', componentCode);
                const ComponentResult = componentFn(React, ReactDOM, context);

                if (!ComponentResult) {
                  throw new Error('Component did not return a valid React component');
                }

                const mountEl = document.getElementById(mId);
                if (mountEl) {
                  const root = (
                    ReactDOM as { createRoot: (el: HTMLElement) => { render: (el: unknown) => void } }
                  ).createRoot(mountEl);
                  root.render(
                    (React as { createElement: (type: unknown, props: unknown) => unknown }).createElement(
                      ComponentResult,
                      { context },
                    ),
                  );
                }
                return;
              } catch (primaryErr: unknown) {
                // If not a CSP/eval error, show the error directly
                if (!(primaryErr instanceof EvalError) && !String(primaryErr).includes('Content Security Policy')) {
                  const mountEl = document.getElementById(mId);
                  if (mountEl) {
                    mountEl.innerHTML =
                      '<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: Component render error \u2014 ' +
                      (primaryErr instanceof Error ? primaryErr.message : String(primaryErr)).replace(/</g, '&lt;') +
                      '</div>';
                  }
                  console.error('[Conjure] Component render error:', primaryErr);
                  return;
                }
                console.log('[Conjure] CSP blocks eval, falling back to script element injection');
              }

              // Fallback: inject via <script> element (works with strict-dynamic CSP)
              // The component code is wrapped in a function expression (not new Function/eval)
              try {
                const scriptContent =
                  '(function() {\n' +
                  'try {\n' +
                  buildContextCode() +
                  '\n' +
                  'var _Component = (function(React, ReactDOM, context) {\n' +
                  componentCode +
                  '\n})(React, ReactDOM, context);\n' +
                  'var mountEl = document.getElementById(' +
                  JSON.stringify(mId) +
                  ');\n' +
                  'if (mountEl && _Component) {\n' +
                  '  var root = ReactDOM.createRoot(mountEl);\n' +
                  '  root.render(React.createElement(_Component, { context: context }));\n' +
                  '} else if (mountEl) {\n' +
                  '  mountEl.innerHTML = \'<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: Component did not return a valid React component.</div>\';\n' +
                  '}\n' +
                  '} catch(err) {\n' +
                  '  var mountEl = document.getElementById(' +
                  JSON.stringify(mId) +
                  ');\n' +
                  '  if (mountEl) {\n' +
                  '    mountEl.innerHTML = \'<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: \' + (err.message || String(err)).replace(/</g, "&lt;") + \'</div>\';\n' +
                  '  }\n' +
                  '  console.error("[Conjure] Component render error:", err);\n' +
                  '}\n' +
                  '})();';

                const script = document.createElement('script');
                script.textContent = scriptContent;
                document.documentElement.appendChild(script);
                script.remove();
              } catch (fallbackErr: unknown) {
                console.error('[Conjure] Script element fallback also failed:', fallbackErr);
                const mountEl = document.getElementById(mId);
                if (mountEl) {
                  mountEl.innerHTML =
                    '<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: Cannot inject component — site CSP blocks both eval and dynamic scripts.</div>';
                }
              }
            },
            args: [transformedCode, mountId, componentId, pageUrl, extId ?? ''],
          });
        }
        return { success: true };
      }

      case 'EXECUTE_MODULE_IN_PAGE': {
        const tabId = sender.tab?.id;
        const {
          code,
          mountId,
          componentId,
          extensionId: extId,
          dependencies,
        } = message.payload as {
          code: string;
          mountId: string;
          componentId: string;
          extensionId?: string;
          dependencies: Record<string, string>;
        };
        if (tabId) {
          const tab = await chrome.tabs.get(tabId);
          const pageUrl = tab.url || '';

          // Build dependency URL map — use ?deps to rewrite bare 'react' specifiers to full URLs
          const reactUrl = `https://esm.sh/react@${REACT_VERSION}`;
          const reactDomUrl = `https://esm.sh/react-dom@${REACT_VERSION}/client?deps=react@${REACT_VERSION}`;
          const depUrls: Record<string, string> = {};
          const depVersions = dependencies ?? {};
          const basePkg = (s: string) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]);
          for (const [pkg, version] of Object.entries(depVersions)) {
            depUrls[pkg] = `https://esm.sh/${pkg}@${version}?deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}`;
          }

          // Parse import statements, strip them, and convert to __deps__ destructuring
          const destructLines: string[] = [];
          const strippedCode = code.replace(
            /^\s*import\s+(.+?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm,
            (_match: string, clause: string, specifier: string) => {
              // Skip react/react-dom — provided via runtime
              if (specifier === 'react' || specifier.startsWith('react-dom')) return '';
              // Handle subpath imports (e.g., 'date-fns/format') by resolving from base package
              if (!depUrls[specifier]) {
                const base = basePkg(specifier);
                const version = depVersions[base];
                if (version) {
                  const subpath = specifier.slice(base.length);
                  depUrls[specifier] =
                    `https://esm.sh/${base}@${version}${subpath}?deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}`;
                } else {
                  return '';
                }
              }

              const safeKey = JSON.stringify(specifier);
              clause = clause.trim();

              if (clause.startsWith('* as ')) {
                destructLines.push(`var ${clause.slice(5).trim()} = __deps__[${safeKey}];`);
              } else if (clause.startsWith('{')) {
                destructLines.push(`var ${clause} = __deps__[${safeKey}];`);
              } else if (clause.includes(',')) {
                const commaIdx = clause.indexOf(',');
                const defaultName = clause.slice(0, commaIdx).trim();
                const rest = clause.slice(commaIdx + 1).trim();
                destructLines.push(`var ${defaultName} = __deps__[${safeKey}].default || __deps__[${safeKey}];`);
                if (rest.startsWith('{')) {
                  destructLines.push(`var ${rest} = __deps__[${safeKey}];`);
                }
              } else {
                destructLines.push(`var ${clause} = __deps__[${safeKey}].default || __deps__[${safeKey}];`);
              }
              return '';
            },
          );

          let transformedCode = destructLines.join('\n') + '\n' + strippedCode;
          try {
            transformedCode = transform(transformedCode, { transforms: ['jsx'] }).code;
          } catch {
            // Code may already be plain JS
          }

          // Auto-append return if missing
          const trimmed = transformedCode.trim();
          if (!trimmed.match(/return\s+\w+\s*;?\s*$/)) {
            const fnMatch = trimmed.match(/function\s+([A-Z]\w*)\s*\(/);
            if (fnMatch) {
              transformedCode = transformedCode + '\nreturn ' + fnMatch[1] + ';';
            }
          }

          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: async (
              componentCode: string,
              mId: string,
              cId: string,
              pUrl: string,
              eId: string,
              depUrlMap: Record<string, string>,
              rUrl: string,
              rdUrl: string,
            ) => {
              // Load React + ReactDOM from esm.sh (same instance used by dependencies via ?deps)
              let React: unknown;
              let ReactDOM: unknown;
              const __deps__: Record<string, unknown> = {};
              try {
                const [reactMod, reactDomMod, ...depMods] = await Promise.all([
                  import(/* webpackIgnore: true */ rUrl),
                  import(/* webpackIgnore: true */ rdUrl),
                  ...Object.values(depUrlMap).map(url => import(/* webpackIgnore: true */ url)),
                ]);
                React = reactMod.default || reactMod;
                ReactDOM = reactDomMod;
                Object.keys(depUrlMap).forEach((key, i) => {
                  __deps__[key] = depMods[i];
                });
              } catch (err) {
                console.error('[Conjure] Failed to load dependencies:', err);
                const mountEl = document.getElementById(mId);
                if (mountEl) {
                  mountEl.innerHTML =
                    '<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: Failed to load dependencies — ' +
                    ((err as Error).message || String(err)).replace(/</g, '&lt;') +
                    '</div>';
                }
                return;
              }

              // Build context
              let _nextReqId = 0;
              const extDbCall = (action: string, payload: Record<string, unknown>): Promise<unknown> =>
                new Promise((resolve, reject) => {
                  const reqId = 'db' + ++_nextReqId + '_' + Date.now();
                  const handler = (e: Event) => {
                    window.removeEventListener('conjure-ext-db-' + reqId, handler);
                    const d = (e as CustomEvent).detail;
                    if (d.error) reject(new Error(d.error));
                    else resolve(d.result);
                  };
                  window.addEventListener('conjure-ext-db-' + reqId, handler);
                  window.dispatchEvent(
                    new CustomEvent('conjure-ext-db', {
                      detail: { extensionId: eId, action, payload, requestId: reqId },
                    }),
                  );
                });

              const getData = (): Promise<Record<string, unknown>> =>
                extDbCall('storageGet', { key: cId + ':' + pUrl }) as Promise<Record<string, unknown>>;
              const setData = (data: Record<string, unknown>): Promise<void> =>
                extDbCall('storageSet', { key: cId + ':' + pUrl, data }) as Promise<void>;
              const sendMessage = (data: unknown): void => {
                window.dispatchEvent(
                  new CustomEvent('conjure-send-worker-message', { detail: { extensionId: eId, data } }),
                );
              };
              const onWorkerMessage = (callback: (data: unknown) => void): (() => void) => {
                const handler = (e: Event) => {
                  const detail = (e as CustomEvent).detail;
                  if (detail?.extensionId !== eId) return;
                  callback(detail.data);
                };
                window.addEventListener('conjure-worker-message', handler);
                return () => window.removeEventListener('conjure-worker-message', handler);
              };
              const db = {
                createTables: (tables: Record<string, string>) => extDbCall('createTables', { tables }),
                removeTables: (tableNames: string[]) => extDbCall('removeTables', { tableNames }),
                getSchema: () => extDbCall('getSchema', {}),
                put: (table: string, data: Record<string, unknown>) =>
                  extDbCall('query', { operation: { type: 'put', table, data } }),
                add: (table: string, data: Record<string, unknown>) =>
                  extDbCall('query', { operation: { type: 'add', table, data } }),
                get: (table: string, key: string | number) =>
                  extDbCall('query', { operation: { type: 'get', table, key } }),
                getAll: (table: string) => extDbCall('query', { operation: { type: 'getAll', table } }),
                update: (table: string, key: string | number, changes: Record<string, unknown>) =>
                  extDbCall('query', { operation: { type: 'update', table, key, changes } }),
                delete: (table: string, key: string | number) =>
                  extDbCall('query', { operation: { type: 'delete', table, key } }),
                where: (table: string, index: string, value: unknown, limit?: number) =>
                  extDbCall('query', { operation: { type: 'where', table, index, value, limit } }),
                bulkPut: (table: string, data: Record<string, unknown>[]) =>
                  extDbCall('query', { operation: { type: 'bulkPut', table, data } }),
                bulkDelete: (table: string, keys: (string | number)[]) =>
                  extDbCall('query', { operation: { type: 'bulkDelete', table, keys } }),
                count: (table: string) => extDbCall('query', { operation: { type: 'count', table } }),
                clear: (table: string) => extDbCall('query', { operation: { type: 'clear', table } }),
              };
              const env = {
                async get(key: string): Promise<string | null> {
                  const envData = ((await extDbCall('storageGet', { key: '_env' })) ?? {}) as Record<string, string>;
                  return envData[key] ?? null;
                },
                async getAll(): Promise<Record<string, string>> {
                  return ((await extDbCall('storageGet', { key: '_env' })) ?? {}) as Record<string, string>;
                },
              };
              const context = { getData, setData, pageUrl: pUrl, sendMessage, onWorkerMessage, db, env };

              // Execute component via new Function (bypasses page CSP from extension context)
              try {
                const componentFn = new Function('React', 'ReactDOM', 'context', '__deps__', componentCode);
                const ComponentResult = componentFn(React, ReactDOM, context, __deps__);

                if (!ComponentResult) {
                  throw new Error('Component did not return a valid React component');
                }

                const mountEl = document.getElementById(mId);
                if (mountEl) {
                  const root = (
                    ReactDOM as { createRoot: (el: HTMLElement) => { render: (el: unknown) => void } }
                  ).createRoot(mountEl);
                  root.render(
                    (React as { createElement: (type: unknown, props: unknown) => unknown }).createElement(
                      ComponentResult,
                      { context },
                    ),
                  );
                }
              } catch (err: unknown) {
                console.error('[Conjure] Component render error:', err);
                const mountEl = document.getElementById(mId);
                if (mountEl) {
                  mountEl.innerHTML =
                    '<div style="padding:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;font:13px system-ui;">Conjure: Component render error — ' +
                    (err instanceof Error ? err.message : String(err)).replace(/</g, '&lt;') +
                    '</div>';
                }
              }
            },
            args: [transformedCode, mountId, componentId, pageUrl, extId ?? '', depUrls, reactUrl, reactDomUrl],
          });
        }
        return { success: true };
      }

      // --- Extension CRUD messages ---

      case 'GET_ALL_EXTENSIONS': {
        const extensions = await getAllExtensions();
        return { extensions };
      }

      case 'CREATE_EXTENSION': {
        const extData = message.payload as Omit<Extension, 'id' | 'createdAt' | 'updatedAt'>;
        const extension = await createExtension(extData);
        return { success: true, extension };
      }

      case 'UPDATE_EXTENSION': {
        const { id: extId, ...extUpdateData } = message.payload as Partial<Extension> & { id: string };
        await updateExtension(extId, extUpdateData);
        return { success: true };
      }

      case 'DELETE_EXTENSION': {
        const { id: extDelId } = message.payload as { id: string };
        await extensionDBManager
          .deleteDatabase(extDelId)
          .catch(err => console.warn('[Conjure] Failed to delete extension DB:', err));
        await deleteExtension(extDelId);
        return { success: true };
      }

      case 'GET_EXTENSION_ARTIFACTS': {
        const { extensionId } = message.payload as { extensionId: string };
        const artifacts = await getArtifactsByExtension(extensionId);
        return { artifacts };
      }

      case 'LOAD_EXTENSIONS': {
        const { url: loadUrl } = message.payload as { url: string };
        const artifacts = await getMatchingExtensionArtifacts(loadUrl);
        for (const artifact of artifacts) {
          if (artifact.type === 'background-worker') {
            dispatchWorkerTrigger(artifact.extensionId, 'url_navigation', {
              url: loadUrl,
              tabId: sender.tab?.id,
              title: sender.tab?.title,
            });
          }
        }
        return { artifacts };
      }

      // --- Agent messages ---

      case 'AGENT_RUN': {
        const { extensionId, message: userMessage } = message.payload as {
          extensionId: string;
          message: string;
        };
        console.log('[Conjure] AGENT_RUN handler entered for extension:', extensionId);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const provider = ((await getSetting<string>('ai_provider')) ?? 'openai') as AIProvider;
        const apiKey = (await getSetting<string>(`ai_api_key_${provider}`)) ?? '';
        const model = (await getSetting<string>('ai_model')) ?? '';

        console.log('[Conjure] Agent config:', {
          provider,
          model,
          hasApiKey: !!apiKey,
          apiKeyLength: apiKey.length,
          tabUrl: tab?.url,
        });

        if (!apiKey) {
          console.error('[Conjure] No API key for provider:', provider);
          return { success: false, error: `API key not configured for provider: ${provider}` };
        }

        console.log('[Conjure] Calling runAgent...');
        runAgent(
          {
            extensionId,
            provider,
            apiKey,
            model,
            tabInfo: tab ? { tabId: tab.id!, url: tab.url ?? '', title: tab.title } : undefined,
          },
          userMessage,
        ).catch(err => console.error('[Conjure] Agent run failed:', err));

        return { success: true };
      }

      case 'AGENT_STOP': {
        const { extensionId: stopExtId } = message.payload as { extensionId: string };
        const stopped = stopAgent(stopExtId);
        return { success: stopped };
      }

      case 'GET_AGENT_STATUS': {
        const { extensionId: statusExtId } = message.payload as { extensionId: string };
        const running = getAgentStatus(statusExtId);
        return { isRunning: running };
      }

      // --- Background worker messages ---

      case 'START_BACKGROUND_WORKER': {
        const { artifactId: startArtifactId } = message.payload as { artifactId: string };
        return startBackgroundWorker(startArtifactId);
      }

      case 'STOP_BACKGROUND_WORKER': {
        const { extensionId: stopWorkerId } = message.payload as { extensionId: string };
        return stopBackgroundWorker(stopWorkerId);
      }

      case 'RELOAD_BACKGROUND_WORKER': {
        const { artifactId: reloadArtifactId } = message.payload as { artifactId: string };
        return reloadBackgroundWorker(reloadArtifactId);
      }

      case 'GET_ALL_WORKER_STATUSES': {
        const statuses = await getAllWorkerStatuses();
        return { statuses };
      }

      case 'GET_WORKER_LOGS': {
        const { extensionId: logExtId } = message.payload as { extensionId: string };
        const logs = getWorkerLogs(logExtId);
        return { logs };
      }

      case 'CLEAR_WORKER_LOGS': {
        const { extensionId: clearLogExtId } = message.payload as { extensionId: string };
        clearWorkerLogs(clearLogExtId);
        return { success: true };
      }

      case 'WORKER_CUSTOM_MESSAGE': {
        const { extensionId: targetExtId, data: customData } = message.payload as {
          extensionId: string;
          data: unknown;
        };
        dispatchWorkerTrigger(targetExtId, 'message', customData);
        return { success: true };
      }

      // --- Extension DB messages ---

      case 'EXT_DB_CREATE_TABLES': {
        const { extensionId: dbExtId, tables } = message.payload as {
          extensionId: string;
          tables: Record<string, string>;
        };
        const schema = await extensionDBManager.createTables(dbExtId, tables);
        return { success: true, schema };
      }

      case 'EXT_DB_REMOVE_TABLES': {
        const { extensionId: dbExtId, tableNames } = message.payload as {
          extensionId: string;
          tableNames: string[];
        };
        const schema = await extensionDBManager.removeTables(dbExtId, tableNames);
        return { success: true, schema };
      }

      case 'EXT_DB_QUERY': {
        const { extensionId: dbExtId, operation } = message.payload as {
          extensionId: string;
          operation: ExtDBOperation;
        };
        const queryResult = await extensionDBManager.query(dbExtId, operation);
        return { success: true, result: queryResult };
      }

      case 'EXT_DB_GET_SCHEMA': {
        const { extensionId: dbExtId } = message.payload as { extensionId: string };
        const schema = await extensionDBManager.getSchema(dbExtId);
        return { success: true, schema };
      }

      case 'EXT_DB_STORAGE_GET': {
        const { extensionId: dbExtId, key } = message.payload as { extensionId: string; key: string };
        const data = await extensionDBManager.storageGet(dbExtId, key);
        return { data };
      }

      case 'EXT_DB_STORAGE_SET': {
        const {
          extensionId: dbExtId,
          key,
          data,
        } = message.payload as {
          extensionId: string;
          key: string;
          data: Record<string, unknown>;
        };
        await extensionDBManager.storageSet(dbExtId, key, data);
        broadcastStorageChange(dbExtId, { key, data });
        return { success: true };
      }

      // --- Database browser messages ---

      case 'DB_BROWSE_LIST_TABLES': {
        const { dbId } = (message.payload ?? {}) as { dbId?: string };
        let targetDb;
        try {
          targetDb = dbId ? await extensionDBManager.getDB(dbId) : db;
        } catch {
          // Extension has no DB yet — return empty
          return { tables: [] };
        }
        const tables = await Promise.all(
          targetDb.tables.map(async (table: Table) => ({
            name: table.name,
            primaryKey: table.schema.primKey.keyPath,
            count: await table.count(),
          })),
        );
        return { tables };
      }

      case 'DB_BROWSE_GET_ROWS': {
        const {
          dbId,
          tableName,
          page = 0,
          pageSize = 20,
        } = message.payload as {
          dbId?: string;
          tableName: string;
          page?: number;
          pageSize?: number;
        };
        const targetDb = dbId ? await extensionDBManager.getDB(dbId) : db;
        const table = targetDb.table(tableName);
        const totalCount = await table.count();
        const rows = await table
          .offset(page * pageSize)
          .limit(pageSize)
          .toArray();
        return { rows, totalCount, page, pageSize };
      }

      case 'DB_BROWSE_PUT_ROW': {
        const { dbId, tableName, data } = message.payload as {
          dbId?: string;
          tableName: string;
          data: Record<string, unknown>;
        };
        const targetDb = dbId ? await extensionDBManager.getDB(dbId) : db;
        const key = await targetDb.table(tableName).put(data);
        return { success: true, key };
      }

      case 'DB_BROWSE_DELETE_ROW': {
        const { dbId, tableName, key } = message.payload as {
          dbId?: string;
          tableName: string;
          key: unknown;
        };
        const targetDb = dbId ? await extensionDBManager.getDB(dbId) : db;
        await targetDb.table(tableName).delete(key as string | number);
        return { success: true };
      }

      default:
        return { error: 'Unknown message type' };
    }
  };

  handler()
    .then(sendResponse)
    .catch(err => {
      console.error('[Conjure] Message handler error:', err);
      sendResponse({ error: err.message });
    });

  return true; // Keep message channel open for async response
});
