/**
 * Where responsive overrides land in MJML's compiled HTML.
 *
 * MJML puts `css-class` on a component's outer wrapper (the `<td>` around a
 * column child, the outer `<div>` of a section/column), while the inline
 * styles to beat sit on inner elements. For every supported attribute we
 * list the selectors (relative to that wrapper, `&`) and the CSS property
 * to override there. Attributes missing from a map can't be overridden per
 * breakpoint and are hidden from the Style Manager in Tablet/Desktop mode.
 */
export interface CssTarget {
  /** Selectors relative to the wrapper; `&` is the wrapper itself. */
  selectors: string[];
  /** CSS property to set. Defaults to the MJML attribute name. */
  property?: string;
}

export type AttributeTargets = Record<string, CssTarget[]>;

const on = (selectors: string | string[], property?: string): CssTarget => ({
  selectors: Array.isArray(selectors) ? selectors : [selectors],
  property,
});

const each = (attrs: string[], target: (attr: string) => CssTarget[]): AttributeTargets =>
  Object.fromEntries(attrs.map((attr) => [attr, target(attr)]));

const PADDINGS = ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
const FONT = ['font-size', 'font-family', 'font-weight', 'font-style', 'color', 'line-height', 'letter-spacing'];
const TEXT_DECOR = ['text-decoration', 'text-transform'];

/** Every column child (text, button, image…) shares the wrapping `<td>`. */
const columnChild: AttributeTargets = {
  ...each(PADDINGS, () => [on('&')]),
  'container-background-color': [on('&', 'background-color')],
};

const BUTTON_LINK = ['& td > a', '& td > p'];
const BUTTON_CELL = '& td[bgcolor]';
const SECTION_CELL = '& > table > tbody > tr > td';

export const RESPONSIVE_TARGETS: Record<string, AttributeTargets> = {
  'mj-text': {
    ...columnChild,
    ...each([...FONT, ...TEXT_DECOR], () => [on('& > div')]),
    align: [on('& > div', 'text-align')],
  },
  'mj-button': {
    ...columnChild,
    ...each([...FONT, ...TEXT_DECOR], () => [on(BUTTON_LINK)]),
    'background-color': [on([BUTTON_CELL, ...BUTTON_LINK])],
    'border-radius': [on([BUTTON_CELL, ...BUTTON_LINK])],
    'inner-padding': [on(BUTTON_LINK, 'padding')],
    width: [on('& > table')],
    height: [on(BUTTON_CELL)],
  },
  'mj-image': {
    ...columnChild,
    width: [on('& > table > tbody > tr > td')],
    height: [on('& img')],
    'border-radius': [on('& img')],
  },
  'mj-divider': {
    ...columnChild,
    width: [on('& > p')],
    'border-width': [on('& > p', 'border-top-width')],
    'border-style': [on('& > p', 'border-top-style')],
    'border-color': [on('& > p', 'border-top-color')],
  },
  'mj-spacer': {
    'container-background-color': columnChild['container-background-color'],
    height: [on('& > div'), on('& > div', 'line-height')],
  },
  'mj-table': {
    ...columnChild,
    ...each(['font-size', 'font-family', 'font-weight', 'font-style', 'color', 'line-height', 'letter-spacing'], () => [
      on('& > table'),
    ]),
  },
  'mj-section': {
    ...each(PADDINGS, () => [on(SECTION_CELL)]),
    'text-align': [on(SECTION_CELL)],
    'background-color': [on(['&', '& > table'])],
    'border-radius': [on(['&', '& > table'])],
  },
  'mj-column': {
    'vertical-align': [on('&')],
  },
};

export const supportsResponsive = (type: string) => type in RESPONSIVE_TARGETS;

export const supportsResponsiveProperty = (type: string, attr: string) => !!RESPONSIVE_TARGETS[type]?.[attr];
