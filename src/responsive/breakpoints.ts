/**
 * Responsive tiers, mobile-first.
 *
 * `mobile` is the base tier: its values are the component's regular MJML
 * attributes and get inlined, so clients without media-query support still
 * render it. `tablet` and `desktop` are overrides applied through
 * `@media (min-width)` rules; each tier inherits from the ones below it.
 */
export type Tier = 'mobile' | 'tablet' | 'desktop';
export type OverrideTier = Exclude<Tier, 'mobile'>;

export const BASE_TIER: Tier = 'mobile';
export const TIERS: Tier[] = ['mobile', 'tablet', 'desktop'];
export const OVERRIDE_TIERS: OverrideTier[] = ['tablet', 'desktop'];

/** Min-width (px) at which each override tier kicks in. */
export type Breakpoints = Record<OverrideTier, number>;

export const DEFAULT_BREAKPOINTS: Breakpoints = { tablet: 480, desktop: 768 };
export const BREAKPOINT_MIN = 240;
export const BREAKPOINT_MAX = 1920;

/** Per-component overrides: tier → { mjml-attribute: value }. */
export type TierOverrides = Partial<Record<OverrideTier, Record<string, string>>>;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Coerce any input into a valid, strictly ascending breakpoint pair. */
export function normalizeBreakpoints(input?: Partial<Breakpoints> | null, fallback = DEFAULT_BREAKPOINTS): Breakpoints {
  const toPx = (value: unknown, def: number) => {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : def;
  };
  const tablet = clamp(toPx(input?.tablet, fallback.tablet), BREAKPOINT_MIN, BREAKPOINT_MAX - 1);
  const desktop = clamp(toPx(input?.desktop, fallback.desktop), tablet + 1, BREAKPOINT_MAX);
  return { tablet, desktop };
}

export const sameBreakpoints = (a: Breakpoints, b: Breakpoints) => a.tablet === b.tablet && a.desktop === b.desktop;

/** Tier a viewport of `width` px falls into. `null` (fluid) → desktop. */
export function tierForWidth(width: number | null, bp: Breakpoints): Tier {
  if (width === null) return 'desktop';
  if (width >= bp.desktop) return 'desktop';
  if (width >= bp.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Canvas width used to preview a tier, guaranteed to fall inside it.
 * `null` means fluid (full canvas width).
 */
export function previewWidthFor(tier: Tier, bp: Breakpoints): number | null {
  switch (tier) {
    case 'mobile':
      return Math.min(320, bp.tablet - 1);
    case 'tablet':
      return clamp(600, bp.tablet, bp.desktop - 1);
    default:
      return null;
  }
}

/** Override tiers that apply at `tier`, lowest first (the cascade). */
export function cascadeFor(tier: Tier): OverrideTier[] {
  return OVERRIDE_TIERS.slice(0, TIERS.indexOf(tier));
}

export const isOverrideTier = (tier: Tier): tier is OverrideTier => tier !== BASE_TIER;
