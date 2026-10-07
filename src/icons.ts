/** Material Design icon paths (24×24) shared by the panels and the responsive bar. */
export const iconPaths = {
  desktop:
    'M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z',
  tablet:
    'M19,18H5V6H19M21,4H3C1.89,4 1,4.89 1,6V18A2,2 0 0,0 3,20H21A2,2 0 0,0 23,18V6C23,4.89 22.1,4 21,4Z',
  mobile:
    'M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z',
  custom: 'M8,18H11V15H2V9H11V6H8L2,12L8,18M14,6V9H22V15H14V18H16L22,12L16,6H14Z',
  import: 'M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z',
  export: 'M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z',
  code: 'M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z',
  undo:
    'M20 13.5C20 17.09 17.09 20 13.5 20H6V18H13.5C16 18 18 16 18 13.5S16 9 13.5 9H7.83L10.91 12.09L9.5 13.5L4 8L9.5 2.5L10.92 3.91L7.83 7H13.5C17.09 7 20 9.91 20 13.5Z',
  redo:
    'M10.5 18H18V20H10.5C6.91 20 4 17.09 4 13.5S6.91 7 10.5 7H16.17L13.08 3.91L14.5 2.5L20 8L14.5 13.5L13.09 12.09L16.17 9H10.5C8 9 6 11 6 13.5S8 18 10.5 18Z',
  // "ruler" — breakpoint settings
  ruler:
    'M1,6V18H23V6H1M3,8H5V12H7V8H9V12H11V8H13V12H15V8H17V12H19V8H21V16H3V8Z',
};

export type IconName = keyof typeof iconPaths;

/** Inline SVG for an icon; sized by the surrounding CSS unless `style` is given. */
export const icon = (name: IconName, style = 'display: block; max-width:22px') =>
  `<svg style="${style}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${iconPaths[name]}"/></svg>`;
