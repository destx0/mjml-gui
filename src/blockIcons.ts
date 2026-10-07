// Block thumbnails: one consistent two-tone set (48×48, 2px rounded strokes,
// translucent accent fills), all drawn with `currentColor` so they follow the
// editor theme.

/** Translucent accent fill. */
const A = 'fill="currentColor" fill-opacity=".2" stroke="none"';
/** Solid fill. */
const S = 'fill="currentColor" stroke="none"';
/** Faded stroke (secondary lines). */
const F = 'stroke-opacity=".45"';

const svg = (body: string) =>
  `<svg class="mj-block-icon" viewBox="0 0 48 48" style="fill:none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const frame = '<rect x="6" y="9" width="36" height="30" rx="3"/>';

export const blockIcons: Record<string, string> = {
  'mj-1-column': svg(`${frame}<rect x="11" y="14" width="26" height="20" rx="1.5" ${A}/>`),
  'mj-2-columns': svg(
    `${frame}<rect x="10.5" y="13.5" width="12" height="21" rx="1.5" ${A}/><rect x="25.5" y="13.5" width="12" height="21" rx="1.5" ${A}/>`,
  ),
  'mj-3-columns': svg(
    `${frame}<rect x="10.5" y="13.5" width="7.5" height="21" rx="1.5" ${A}/><rect x="20.25" y="13.5" width="7.5" height="21" rx="1.5" ${A}/><rect x="30" y="13.5" width="7.5" height="21" rx="1.5" ${A}/>`,
  ),
  'mj-group': svg(
    `<rect x="6" y="9" width="36" height="30" rx="3" stroke-dasharray="3 3.5"/><rect x="10.5" y="13.5" width="12" height="21" rx="1.5" ${A}/><rect x="25.5" y="13.5" width="12" height="21" rx="1.5" ${A}/><path d="M22.5 24h3"/>`,
  ),
  'mj-wrapper': svg(
    `<rect x="5" y="6" width="38" height="36" rx="3"/><rect x="10" y="11" width="28" height="11" rx="1.5" ${A}/><rect x="10" y="26" width="28" height="11" rx="1.5" ${A}/>`,
  ),
  'mj-hero': svg(
    `<rect x="4" y="8" width="40" height="32" rx="3" ${A}/><rect x="4" y="8" width="40" height="32" rx="3"/><path d="M13 18h22" stroke-width="3"/><path d="M16 24h16" ${F}/><rect x="17" y="29" width="14" height="6" rx="3" ${S}/>`,
  ),

  'mj-text': svg(
    `<path d="M8 10h18M17 10v18" stroke-width="3"/><path d="M30 17h10M30 23h10"/><path d="M8 34h32M8 40h22" ${F}/>`,
  ),
  'mj-button': svg(
    `<rect x="5" y="15" width="38" height="18" rx="9" ${A}/><rect x="5" y="15" width="38" height="18" rx="9"/><path d="M16 24h16" stroke-width="2.5"/>`,
  ),
  'mj-image': svg(
    `${frame}<circle cx="16" cy="18" r="3" ${S}/><path d="M7 38l11-12 7 7 6-6 10 10z" ${A}/><path d="M7 37l11-11 7 7 6-6 10 10"/>`,
  ),
  'mj-divider': svg(`<path d="M10 14h22M10 34h26" ${F}/><path d="M5 24h38" stroke-width="2.5"/>`),
  'mj-spacer': svg(`<path d="M8 7h32M8 41h32"/><path d="M24 14v20M19 19l5-5 5 5M19 29l5 5 5-5" ${F}/>`),
  'mj-table': svg(
    `<path d="M6 12a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v7H6z" ${A}/>${frame}<path d="M6 19h36M6 29h36M20 9v30"/>`,
  ),

  'mj-icon-text': svg(
    `<circle cx="14" cy="24" r="7.5" ${A}/><circle cx="14" cy="24" r="7.5"/><path d="M27 19h14" stroke-width="3"/><path d="M27 26h14M27 31h9" ${F}/>`,
  ),
  'mj-icon-text-right': svg(
    `<circle cx="34" cy="24" r="7.5" ${A}/><circle cx="34" cy="24" r="7.5"/><path d="M7 19h14" stroke-width="3"/><path d="M7 26h14M7 31h9" ${F}/>`,
  ),
  'mj-icon-text-top': svg(
    `<rect x="8" y="5" width="32" height="38" rx="4" ${A}/><rect x="8" y="5" width="32" height="38" rx="4"/><circle cx="24" cy="16" r="5"/><path d="M16 27h16" stroke-width="3"/><path d="M14 33h20M18 38h12" ${F}/>`,
  ),

  'mj-navbar': svg(
    `<rect x="4" y="16" width="40" height="16" rx="3" ${A}/><rect x="4" y="16" width="40" height="16" rx="3"/><path d="M10 24h6M21 24h6M32 24h6"/>`,
  ),
  'mj-navbar-link': svg(
    `<path d="M20 28a7 7 0 0 0 10 0l6-6a7 7 0 0 0-10-10l-2 2"/><path d="M28 20a7 7 0 0 0-10 0l-6 6a7 7 0 0 0 10 10l2-2"/>`,
  ),
  'mj-social-group': svg(
    `<circle cx="11" cy="24" r="6" ${A}/><circle cx="24" cy="24" r="6" ${A}/><circle cx="37" cy="24" r="6" ${A}/><circle cx="11" cy="24" r="6"/><circle cx="24" cy="24" r="6"/><circle cx="37" cy="24" r="6"/>`,
  ),
  'mj-social-element': svg(
    `<circle cx="15" cy="24" r="4.5" ${A}/><circle cx="33" cy="14" r="4.5" ${A}/><circle cx="33" cy="34" r="4.5" ${A}/><circle cx="15" cy="24" r="4.5"/><circle cx="33" cy="14" r="4.5"/><circle cx="33" cy="34" r="4.5"/><path d="M19 22l10-6M19 26l10 6"/>`,
  ),

  'mj-accordion': svg(
    `<rect x="6" y="6" width="36" height="10" rx="2" ${A}/><rect x="6" y="6" width="36" height="10" rx="2"/><path d="M33 10l3 3 3-3"/><path d="M10 21h22M10 26h16" ${F}/><rect x="6" y="31" width="36" height="10" rx="2"/><path d="M35 33l3 3-3 3"/>`,
  ),
  'mj-carousel': svg(
    `<rect x="11" y="9" width="26" height="22" rx="2" ${A}/><rect x="11" y="9" width="26" height="22" rx="2"/><path d="M7 16l-4 4 4 4M41 16l4 4-4 4"/><circle cx="19" cy="38" r="1.8" ${S}/><circle cx="24" cy="38" r="1.8" fill="currentColor" fill-opacity=".45" stroke="none"/><circle cx="29" cy="38" r="1.8" fill="currentColor" fill-opacity=".45" stroke="none"/>`,
  ),
  'mj-raw': svg(`<path d="M16 15l-9 9 9 9M32 15l9 9-9 9"/><path d="M27 11l-6 26" ${F}/>`),
};

/** Category keys in panel order. */
export const categoryOrder = ['layout', 'content', 'cards', 'navigation', 'interactive', 'advanced'];

/** Block id → category key (labels in `grapesjs-mjml.categories.*`). */
export const blockCategories: Record<string, string> = {
  'mj-1-column': 'layout',
  'mj-2-columns': 'layout',
  'mj-3-columns': 'layout',
  'mj-group': 'layout',
  'mj-wrapper': 'layout',
  'mj-hero': 'layout',
  'mj-text': 'content',
  'mj-button': 'content',
  'mj-image': 'content',
  'mj-divider': 'content',
  'mj-spacer': 'content',
  'mj-table': 'content',
  'mj-icon-text': 'cards',
  'mj-icon-text-right': 'cards',
  'mj-icon-text-top': 'cards',
  'mj-navbar': 'navigation',
  'mj-navbar-link': 'navigation',
  'mj-social-group': 'navigation',
  'mj-social-element': 'navigation',
  'mj-accordion': 'interactive',
  'mj-carousel': 'interactive',
  'mj-raw': 'advanced',
};

export const blockIconCss = `
  .gjs-block .mj-block-icon { width: 44px; height: 44px; display: block; margin: 0 auto; }
  .gjs-block:hover .mj-block-icon { color: inherit; }
`;
