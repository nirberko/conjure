import React from 'react';
import ReactDOM from 'react-dom/client';
import { transform } from 'sucrase';

type MessageType =
  | 'RENDER_COMPONENT'
  | 'RENDER_SUCCESS'
  | 'RENDER_ERROR'
  | 'GET_DATA'
  | 'DATA_RESPONSE'
  | 'SET_DATA'
  | 'SET_DATA_RESPONSE'
  | 'RESIZE';

interface SandboxMessage {
  type: MessageType;
  [key: string]: unknown;
}

const rootEl = document.getElementById('root')!;
let currentRoot: ReactDOM.Root | null = null;
let requestCounter = 0;
const pendingRequests = new Map<string, (value: unknown) => void>();

// Listen for postMessage from parent
window.addEventListener('message', event => {
  const msg = event.data as SandboxMessage;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'RENDER_COMPONENT':
      handleRender(msg as { type: 'RENDER_COMPONENT'; code: string; componentId: string; pageUrl: string });
      break;
    case 'DATA_RESPONSE':
      handleDataResponse(msg as { type: 'DATA_RESPONSE'; requestId: string; data: Record<string, unknown> });
      break;
    case 'SET_DATA_RESPONSE':
      handleSetDataResponse(msg as { type: 'SET_DATA_RESPONSE'; requestId: string });
      break;
  }
});

function handleRender(msg: { code: string; componentId: string; pageUrl: string }) {
  try {
    // Clean up previous render
    if (currentRoot) {
      currentRoot.unmount();
      currentRoot = null;
    }
    rootEl.innerHTML = '';

    const context = {
      pageUrl: msg.pageUrl,
      getData: (): Promise<Record<string, unknown>> => {
        const requestId = `req_${++requestCounter}`;
        return new Promise(resolve => {
          pendingRequests.set(requestId, resolve as (value: unknown) => void);
          window.parent.postMessage({ type: 'GET_DATA', requestId, componentId: msg.componentId }, '*');
        });
      },
      setData: (data: Record<string, unknown>): Promise<void> => {
        const requestId = `req_${++requestCounter}`;
        return new Promise(resolve => {
          pendingRequests.set(requestId, resolve as (value: unknown) => void);
          window.parent.postMessage({ type: 'SET_DATA', requestId, componentId: msg.componentId, data }, '*');
        });
      },
    };

    // Transform JSX to React.createElement calls; fall back to raw code on error
    let transformedCode = msg.code;
    try {
      transformedCode = transform(msg.code, { transforms: ['jsx'] }).code;
    } catch {
      // Code may already be plain JS — use as-is
    }

    // Execute the component code via new Function() — allowed in sandbox pages
    const ComponentFn = new Function('React', 'ReactDOM', 'context', transformedCode);
    const Component = ComponentFn(React, ReactDOM, context);

    if (!Component) {
      postToParent({ type: 'RENDER_ERROR', error: 'Component function did not return a component' });
      return;
    }

    currentRoot = ReactDOM.createRoot(rootEl);
    currentRoot.render(React.createElement(Component, { context }));
    postToParent({ type: 'RENDER_SUCCESS' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    postToParent({ type: 'RENDER_ERROR', error: message });
  }
}

function handleDataResponse(msg: { requestId: string; data: Record<string, unknown> }) {
  const resolve = pendingRequests.get(msg.requestId);
  if (resolve) {
    pendingRequests.delete(msg.requestId);
    resolve(msg.data);
  }
}

function handleSetDataResponse(msg: { requestId: string }) {
  const resolve = pendingRequests.get(msg.requestId);
  if (resolve) {
    pendingRequests.delete(msg.requestId);
    resolve(undefined);
  }
}

// Observe size changes and report to parent for iframe auto-sizing
const resizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    const height = Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height);
    postToParent({ type: 'RESIZE', height });
  }
});
resizeObserver.observe(rootEl);

function postToParent(msg: SandboxMessage) {
  window.parent.postMessage(msg, '*');
}
