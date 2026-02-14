import { loadComponentsForPage } from '../../component-loader.js';
import { activate as activatePicker } from '../../element-picker.js';
import { injectArtifact, removeArtifact, isArtifactInjected } from '../../injector.js';
import type { Artifact } from '@extension/shared';

console.log('[WebForge] Content script loaded');

// Auto-load extensions for current page
loadComponentsForPage();

// DOM inspection helpers
function serializeDOM(el: Element, depth: number): string {
  if (depth <= 0) return `<${el.tagName.toLowerCase()} .../>`;
  const attrs = Array.from(el.attributes)
    .map(a => `${a.name}="${a.value}"`)
    .join(' ');
  const tag = el.tagName.toLowerCase();
  const attrStr = attrs ? ` ${attrs}` : '';

  if (el.children.length === 0) {
    const text = el.textContent?.trim().slice(0, 100) ?? '';
    return text ? `<${tag}${attrStr}>${text}</${tag}>` : `<${tag}${attrStr}/>`;
  }

  const children = Array.from(el.children)
    .slice(0, 20) // Limit to 20 children
    .map(child => serializeDOM(child, depth - 1))
    .join('\n');

  const remaining = el.children.length > 20 ? `\n<!-- +${el.children.length - 20} more -->` : '';
  return `<${tag}${attrStr}>\n${children}${remaining}\n</${tag}>`;
}

function getComputedStyleSummary(el: Element): Record<string, string> {
  const computed = window.getComputedStyle(el);
  const props = [
    'display',
    'position',
    'width',
    'height',
    'margin',
    'padding',
    'background',
    'color',
    'fontSize',
    'fontFamily',
    'border',
    'flexDirection',
    'justifyContent',
    'alignItems',
    'gridTemplateColumns',
    'overflow',
    'zIndex',
    'opacity',
    'visibility',
  ];
  const result: Record<string, string> = {};
  for (const prop of props) {
    const val = computed.getPropertyValue(prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
    if (val) result[prop] = val;
  }
  return result;
}

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'ACTIVATE_PICKER':
      activatePicker();
      sendResponse({ success: true });
      break;

    // --- Artifact-based messages ---

    case 'INJECT_ARTIFACT':
      injectArtifact(message.payload as Artifact).then(result => {
        sendResponse(result);
      });
      break;

    case 'REMOVE_ARTIFACT': {
      const { id: artifactId } = message.payload as { id: string };
      removeArtifact(artifactId);
      sendResponse({ success: true });
      break;
    }

    case 'INSPECT_DOM': {
      const { selector, depth = 3 } = (message.payload ?? {}) as { selector?: string; depth?: number };
      try {
        const el = selector ? document.querySelector(selector) : document.body;
        if (!el) {
          sendResponse({ error: `Element not found: ${selector}` });
        } else {
          sendResponse(serializeDOM(el, depth));
        }
      } catch (err) {
        sendResponse({ error: String(err) });
      }
      break;
    }

    case 'INSPECT_STYLES': {
      const { selector: styleSelector } = (message.payload ?? {}) as { selector: string };
      try {
        const el = document.querySelector(styleSelector);
        if (!el) {
          sendResponse({ error: `Element not found: ${styleSelector}` });
        } else {
          sendResponse(getComputedStyleSummary(el));
        }
      } catch (err) {
        sendResponse({ error: String(err) });
      }
      break;
    }

    case 'READ_PAGE_TEXT': {
      const { selector: textSelector } = (message.payload ?? {}) as { selector: string };
      try {
        const el = document.querySelector(textSelector);
        if (!el) {
          sendResponse({ error: `Element not found: ${textSelector}` });
        } else {
          sendResponse(el.textContent?.trim().slice(0, 5000) ?? '');
        }
      } catch (err) {
        sendResponse({ error: String(err) });
      }
      break;
    }

    case 'VERIFY_DEPLOYMENT': {
      const { artifactId, expectedSelector } = (message.payload ?? {}) as {
        artifactId: string;
        expectedSelector?: string;
      };
      const exists = isArtifactInjected(artifactId);
      let selectorFound = true;

      if (expectedSelector) {
        selectorFound = !!document.querySelector(expectedSelector);
      }

      sendResponse({
        injected: exists,
        selectorFound,
        success: exists && selectorFound,
      });
      break;
    }

    case 'WORKER_MESSAGE': {
      // Dispatch a custom event so injected React components can listen to
      // messages from background workers
      window.dispatchEvent(
        new CustomEvent('webforge-worker-message', {
          detail: message.payload,
        }),
      );
      sendResponse({ success: true });
      break;
    }
  }
  return true;
});
