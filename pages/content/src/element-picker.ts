let overlay: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;
let active = false;
let hoveredElement: Element | null = null;

const getCssSelector = (el: Element): string => {
  if (el.id) return `#${el.id}`;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter(c => c.length > 0 && !c.includes(':'))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
};

const createOverlay = () => {
  overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);z-index:2147483647;transition:all 0.1s ease;display:none;';

  label = document.createElement('div');
  label.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483647;background:#1e293b;color:#e2e8f0;font:12px/1.4 monospace;padding:4px 8px;border-radius:4px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none;';

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(label);
};

const onMouseMove = (e: MouseEvent) => {
  if (!active || !overlay || !label) return;

  const target = e.target as Element;
  if (target === overlay || target === label) return;

  hoveredElement = target;
  const rect = target.getBoundingClientRect();

  overlay.style.display = 'block';
  overlay.style.top = rect.top + 'px';
  overlay.style.left = rect.left + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';

  const selector = getCssSelector(target);
  label.textContent = selector;
  label.style.display = 'block';
  label.style.top = Math.max(0, rect.top - 28) + 'px';
  label.style.left = rect.left + 'px';
};

const onClick = (e: MouseEvent) => {
  if (!active || !hoveredElement) return;

  e.preventDefault();
  e.stopPropagation();

  const selector = getCssSelector(hoveredElement);
  chrome.runtime.sendMessage({
    type: 'PICKER_RESULT',
    payload: { selector, tagName: hoveredElement.tagName.toLowerCase() },
  });

  deactivate();
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    chrome.runtime.sendMessage({
      type: 'PICKER_RESULT',
      payload: null,
    });
    deactivate();
  }
};

export const activate = () => {
  if (active) return;
  active = true;

  createOverlay();
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.body.style.cursor = 'crosshair';
};

export const deactivate = () => {
  if (!active) return;
  active = false;

  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.body.style.cursor = '';

  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  if (label) {
    label.remove();
    label = null;
  }
  hoveredElement = null;
};
