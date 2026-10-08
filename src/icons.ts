/**
 * Editor UI icons: one stroke-style set (24×24, 1.8px rounded strokes,
 * `currentColor`) for the top bar, panels, device bar and trait headings.
 */
export const uiIconBodies = {
  // Devices / viewport
  mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  tablet: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M11 18h2"/>',
  desktop: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/>',
  width: '<path d="M3 12h18M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  ruler: '<rect x="2.5" y="7.5" width="19" height="9" rx="1.5"/><path d="M6.5 7.5v3M10.5 7.5v4.5M14.5 7.5v3M18.5 7.5v4.5"/>',
  // Top bar actions
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>',
  import: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15"/>',
  export: '<path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9M4.5 19.5h15"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  outline: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  // Right panel views
  style: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  blocks:
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  // Trait group headings
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M13 10h5M13 14h3"/>',
};

export type UiIconName = keyof typeof uiIconBodies;

/** Inline SVG for a UI icon; sized by the surrounding CSS. */
export const uiIcon = (name: UiIconName, className = '') =>
  `<svg${className ? ` class="${className}"` : ''} viewBox="0 0 24 24" style="fill:none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${uiIconBodies[name]}</svg>`;
