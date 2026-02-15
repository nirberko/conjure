// ---------- helpers ----------

const normalizeToHex = (raw: string): string | null => {
  const v = raw.trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'currentcolor' || v === 'inherit' || v === 'initial') return null;

  // Already hex
  if (/^#[0-9a-f]{3,8}$/i.test(v)) {
    if (v.length === 4) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    if (v.length === 7) return v;
    return v.slice(0, 7); // strip alpha from #rrggbbaa
  }

  const rgbaMatch = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (rgbaMatch) {
    let alpha = 1;
    if (rgbaMatch[4] !== undefined) {
      alpha = rgbaMatch[4].endsWith('%') ? parseFloat(rgbaMatch[4]) / 100 : parseFloat(rgbaMatch[4]);
    }
    if (alpha < 0.05) return null; // effectively transparent
    const r = Math.round(Number(rgbaMatch[1]));
    const g = Math.round(Number(rgbaMatch[2]));
    const b = Math.round(Number(rgbaMatch[3]));
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  return null;
};

// ---------- sub-extractors ----------

const extractCSSCustomProperties = (): Record<string, string> => {
  const vars: Record<string, string> = {};
  const designPrefixes = [
    '--color',
    '--bg',
    '--text',
    '--font',
    '--spacing',
    '--radius',
    '--shadow',
    '--border',
    '--primary',
    '--secondary',
    '--accent',
    '--surface',
    '--muted',
    '--foreground',
    '--background',
    '--ring',
    '--input',
    '--card',
    '--popover',
    '--destructive',
    '--chart',
  ];

  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        const sel = rule.selectorText;
        if (!sel || (sel !== ':root' && sel !== 'html' && sel !== 'body' && sel !== ':root, :host')) continue;
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (!prop.startsWith('--')) continue;
          vars[prop] = rule.style.getPropertyValue(prop).trim();
        }
      }
    }
  } catch {
    // safety net
  }

  // Prioritize design-relevant vars, limit to 50
  const entries = Object.entries(vars);
  if (entries.length <= 50) return vars;

  const prioritized = entries.filter(([k]) => designPrefixes.some(p => k.startsWith(p)));
  const rest = entries.filter(([k]) => !designPrefixes.some(p => k.startsWith(p)));
  const kept = [...prioritized, ...rest].slice(0, 50);
  return Object.fromEntries(kept);
};

const SAMPLE_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'a',
  'li',
  'div',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'img',
  'table',
  'th',
  'td',
  'form',
];

const sampleElements = (root: Element, maxTotal: number): Element[] => {
  const perTag = Math.max(2, Math.floor(maxTotal / SAMPLE_TAGS.length));
  const result: Element[] = [];

  for (const tag of SAMPLE_TAGS) {
    const els = root.querySelectorAll(tag);
    let added = 0;
    for (const el of Array.from(els)) {
      if (added >= perTag) break;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      result.push(el);
      added++;
    }
    if (result.length >= maxTotal) break;
  }

  return result.slice(0, maxTotal);
};

interface ColorEntry {
  color: string;
  count: number;
  usage: string[];
}

const extractColorPalette = (elements: Element[]): ColorEntry[] => {
  const colorMap = new Map<string, { count: number; usage: Set<string> }>();

  const record = (raw: string, usage: string) => {
    const hex = normalizeToHex(raw);
    if (!hex) return;
    const entry = colorMap.get(hex) || { count: 0, usage: new Set<string>() };
    entry.count++;
    entry.usage.add(usage);
    colorMap.set(hex, entry);
  };

  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    record(cs.backgroundColor, 'background');
    record(cs.color, 'text');
    record(cs.borderColor, 'border');

    const tag = el.tagName.toLowerCase();
    if (tag === 'a') record(cs.color, 'link');
    if (tag === 'button') record(cs.backgroundColor, 'button-bg');
  }

  return Array.from(colorMap.entries())
    .map(([color, { count, usage }]) => ({ color, count, usage: Array.from(usage) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
};

interface TypographyResult {
  families: string[];
  sizeScale: string[];
  weights: string[];
  headingStyles: Record<string, { fontSize: string; fontWeight: string; lineHeight: string }>;
  bodyFontSize: string;
  bodyLineHeight: string;
}

const extractTypography = (elements: Element[], root: Element): TypographyResult => {
  const familyCount = new Map<string, number>();
  const sizes = new Set<string>();
  const weights = new Set<string>();

  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    const fam = cs.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    familyCount.set(fam, (familyCount.get(fam) || 0) + 1);
    sizes.add(cs.fontSize);
    weights.add(cs.fontWeight);
  }

  const headingStyles: Record<string, { fontSize: string; fontWeight: string; lineHeight: string }> = {};
  for (let i = 1; i <= 6; i++) {
    const h = root.querySelector(`h${i}`);
    if (h) {
      const cs = window.getComputedStyle(h);
      headingStyles[`h${i}`] = {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
      };
    }
  }

  const bodyCs = window.getComputedStyle(root === document.body ? root : document.body);
  const sizeArr = Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b));

  return {
    families: Array.from(familyCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([f]) => f),
    sizeScale: sizeArr,
    weights: Array.from(weights).sort((a, b) => Number(a) - Number(b)),
    headingStyles,
    bodyFontSize: bodyCs.fontSize,
    bodyLineHeight: bodyCs.lineHeight,
  };
};

interface SpacingResult {
  commonPaddings: string[];
  commonMargins: string[];
  commonGaps: string[];
}

const extractSpacing = (elements: Element[]): SpacingResult => {
  const paddings = new Map<string, number>();
  const margins = new Map<string, number>();
  const gaps = new Map<string, number>();

  for (const el of elements) {
    const cs = window.getComputedStyle(el);

    const pad = cs.padding;
    if (pad && pad !== '0px') paddings.set(pad, (paddings.get(pad) || 0) + 1);

    const mar = cs.margin;
    if (mar && mar !== '0px') margins.set(mar, (margins.get(mar) || 0) + 1);

    const gap = cs.gap;
    if (gap && gap !== 'normal' && gap !== '0px') gaps.set(gap, (gaps.get(gap) || 0) + 1);
  }

  const topN = (map: Map<string, number>, n: number) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([v]) => v);

  return {
    commonPaddings: topN(paddings, 5),
    commonMargins: topN(margins, 5),
    commonGaps: topN(gaps, 5),
  };
};

interface BorderShadowResult {
  borderRadii: string[];
  boxShadows: string[];
  borderStyles: string[];
}

const extractBorderShadow = (elements: Element[]): BorderShadowResult => {
  const radii = new Map<string, number>();
  const shadows = new Map<string, number>();
  const borders = new Map<string, number>();

  for (const el of elements) {
    const cs = window.getComputedStyle(el);

    const br = cs.borderRadius;
    if (br && br !== '0px') radii.set(br, (radii.get(br) || 0) + 1);

    const bs = cs.boxShadow;
    if (bs && bs !== 'none') shadows.set(bs, (shadows.get(bs) || 0) + 1);

    const border = cs.border;
    if (border && border !== 'none' && !border.startsWith('0px')) {
      borders.set(border, (borders.get(border) || 0) + 1);
    }
  }

  const topN = (map: Map<string, number>, n: number) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([v]) => v);

  return {
    borderRadii: topN(radii, 5),
    boxShadows: topN(shadows, 5),
    borderStyles: topN(borders, 5),
  };
};

const getStyleSnapshot = (el: Element): Record<string, string> => {
  const cs = window.getComputedStyle(el);
  const props = [
    'display',
    'padding',
    'margin',
    'background',
    'backgroundColor',
    'color',
    'fontSize',
    'fontFamily',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'border',
    'borderRadius',
    'boxShadow',
    'outline',
    'cursor',
    'textDecoration',
    'textTransform',
  ];
  const result: Record<string, string> = {};
  for (const prop of props) {
    const val = cs.getPropertyValue(prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
    if (val) result[prop] = val;
  }
  return result;
};

const extractInteractiveStyles = (root: Element): Record<string, Record<string, string> | null> => {
  const findVisible = (selector: string): Element | null => {
    for (const el of Array.from(root.querySelectorAll(selector))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const cs = window.getComputedStyle(el);
        if (cs.display !== 'none' && cs.visibility !== 'hidden') return el;
      }
    }
    return null;
  };

  const button = findVisible('button');
  const link = findVisible('a[href]');
  const input = findVisible('input');

  return {
    button: button ? getStyleSnapshot(button) : null,
    link: link ? getStyleSnapshot(link) : null,
    input: input ? getStyleSnapshot(input) : null,
  };
};

// ---------- main ----------

export const extractPageTheme = (scopeSelector?: string) => {
  const root = scopeSelector ? document.querySelector(scopeSelector) : document.body;
  if (!root) {
    return { error: `Element not found: ${scopeSelector}` };
  }

  const cssVariables = extractCSSCustomProperties();
  const elements = sampleElements(root, 200);
  const colorPalette = extractColorPalette(elements);
  const typography = extractTypography(elements, root);
  const spacing = extractSpacing(elements);
  const borderShadow = extractBorderShadow(elements);
  const interactiveElements = extractInteractiveStyles(root);

  return {
    cssVariables,
    colorPalette,
    typography,
    spacing,
    borderShadow,
    interactiveElements,
  };
};
