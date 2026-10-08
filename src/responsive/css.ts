import { Breakpoints, OVERRIDE_TIERS, OverrideTier, TierOverrides, cascadeFor, normalizeBreakpoints, Tier } from './breakpoints';
import { RESPONSIVE_TARGETS } from './targets';

/** Class added to a component's `css-class` when it has overrides. */
export const RESPONSIVE_CLASS_PREFIX = 'mjr-';

/**
 * Tag inside the generated `<mj-style>` comment. The comment carries the
 * overrides as JSON so they survive a round-trip through MJML source
 * (import, code dock edits) without reverse-engineering the CSS.
 */
export const RESPONSIVE_MARKER = 'grapesjs-mjml:responsive';

export interface ResponsiveEntry {
  /** MJML tag, e.g. `mj-text`. */
  type: string;
  className: string;
  overrides: TierOverrides;
}

/**
 * Extra rules contributed by components (e.g. the icon card's fixed column
 * widths), per tier. `mobile` rules are emitted without a media query.
 */
export type TierCss = Partial<Record<Tier, string[]>>;

export interface ResponsiveMeta {
  breakpoints: Breakpoints;
  /** className → overrides */
  overrides: Record<string, TierOverrides>;
}

/** Strip anything that could break out of a CSS declaration. */
const cssValue = (value: string) =>
  String(value)
    .replace(/!important/gi, '')
    .replace(/[;{}<>]/g, '')
    .trim();

/** `selector { prop: value !important; … }` rules for one tier of one component. */
function tierRules({ type, className, overrides }: ResponsiveEntry, tier: OverrideTier): string[] {
  const targets = RESPONSIVE_TARGETS[type];
  const style = overrides[tier];
  if (!targets || !style) return [];

  // Group declarations by selector, keeping first-seen order.
  const bySelector = new Map<string, string[]>();
  Object.keys(style).forEach((attr) => {
    const value = cssValue(style[attr]);
    if (!value) return;
    (targets[attr] || []).forEach(({ selectors, property }) => {
      const selector = selectors.map((sel) => sel.replace(/&/g, `.${className}`)).join(', ');
      const decls = bySelector.get(selector) || [];
      decls.push(`${property || attr}: ${value} !important;`);
      bySelector.set(selector, decls);
    });
  });

  return Array.from(bySelector, ([selector, decls]) => `${selector} { ${decls.join(' ')} }`);
}

const indent = (lines: string[], pad = '  ') => lines.map((line) => pad + line);

/**
 * Export CSS: one `min-width` media query per override tier, plus the
 * JSON meta comment used to restore the overrides on import.
 */
export function buildExportCss(entries: ResponsiveEntry[], breakpoints: Breakpoints, extra: TierCss = {}): string {
  const base = extra.mobile || [];
  const blocks = OVERRIDE_TIERS.map((tier) => {
    const rules = [...entries.flatMap((entry) => tierRules(entry, tier)), ...(extra[tier] || [])];
    if (!rules.length) return '';
    return [`@media only screen and (min-width: ${breakpoints[tier]}px) {`, ...indent(rules), '}'].join('\n');
  }).filter(Boolean);

  if (!blocks.length && !base.length) return '';

  return [serializeMeta({ breakpoints, overrides: toOverrideMap(entries) }), ...base, ...blocks].join('\n');
}

/**
 * Canvas preview CSS: the cascade up to `tier`, without media queries, so
 * the canvas always shows exactly the tier being edited.
 */
export function buildPreviewCss(entries: ResponsiveEntry[], tier: Tier, extra: TierCss = {}): string {
  return [
    ...(extra.mobile || []),
    ...cascadeFor(tier).flatMap((t) => [...entries.flatMap((entry) => tierRules(entry, t)), ...(extra[t] || [])]),
  ].join('\n');
}

const toOverrideMap = (entries: ResponsiveEntry[]) =>
  Object.fromEntries(entries.map(({ className, overrides }) => [className, overrides]));

export function serializeMeta(meta: ResponsiveMeta): string {
  // `*/` would close the comment early; `\/` is a valid JSON escape for `/`.
  const json = JSON.stringify(meta).replace(/\*\//g, '*\\/');
  return `/* ${RESPONSIVE_MARKER} ${json} */`;
}

/** Read the meta comment back from `<mj-style>` text, `null` if absent/invalid. */
export function parseMeta(css: string): ResponsiveMeta | null {
  const start = css.indexOf(RESPONSIVE_MARKER);
  if (start < 0) return null;
  const end = css.indexOf('*/', start);
  const json = css.slice(start + RESPONSIVE_MARKER.length, end < 0 ? undefined : end).trim();

  try {
    const meta = JSON.parse(json);
    const overrides: Record<string, TierOverrides> = {};
    Object.keys(meta?.overrides || {}).forEach((className) => {
      const clean = cleanOverrides(meta.overrides[className]);
      if (clean) overrides[className] = clean;
    });
    return { breakpoints: normalizeBreakpoints(meta?.breakpoints), overrides };
  } catch {
    return null;
  }
}

/** Drop empty tiers/values; `undefined` when nothing is left. */
export function cleanOverrides(input: unknown): TierOverrides | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const result: TierOverrides = {};

  OVERRIDE_TIERS.forEach((tier) => {
    const style = (input as any)[tier];
    if (!style || typeof style !== 'object') return;
    const clean: Record<string, string> = {};
    Object.keys(style).forEach((attr) => {
      const value = style[attr];
      if (!attr.startsWith('__') && value !== '' && value != null) clean[attr] = String(value);
    });
    if (Object.keys(clean).length) result[tier] = clean;
  });

  return Object.keys(result).length ? result : undefined;
}
