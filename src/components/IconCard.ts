// Icon card: a regular mj-section (marked with `css-class="icon-card"`) whose
// children are ordinary MJML components — an icon column holding an mj-image
// and a content column holding mj-text (and anything else dropped there).
// Every part is selected and edited like any other component (full Style
// Manager, rich text, per-breakpoint overrides). The card itself only adds
// layout settings — icon position, icon size per breakpoint, gap, vertical
// alignment and "stack on mobile" — which restructure the children in place.
//
// The layout is never stored separately: it's derived from the children, so
// imported/hand-written MJML with the marker class is recognised as is.
//
// Fixed icon, fluid text: MJML columns only do % or px (px columns overflow
// between MJML's breakpoint and the body width). So the columns carry a %
// width matching the Mobile icon size (fallback for clients without <style>
// support, e.g. Outlook desktop — mobile-first, like all responsive styles),
// and generated rules pin the icon column to `size + gap` px per breakpoint
// with the content column taking `calc(100% - …)`. The icon size per
// breakpoint is the icon image's own width (base attribute + Tablet/Desktop
// overrides), so editing the image in the Style Manager stays in sync.
import type { Component, Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { getName } from './utils';
import { type as typeSection } from './Section';
import { type as typeGroup } from './Group';
import { type as typeColumn } from './Column';
import { type as typeImage } from './Image';
import { type as typeBody } from './Body';
import { type as typeWrapper } from './Wrapper';
import { groupTrait } from '../traits';
import { OVERRIDE_TIERS, OverrideTier, Tier, TierCss, getOverrides, getResponsive, RESPONSIVE_PROP } from '../responsive';

export const type = 'mj-icon-card';
export const CARD_CLASS = 'icon-card';
/** css-class of the icon / content columns. */
export const ICON_COL_CLASS = 'icon-card-icon';
export const BODY_COL_CLASS = 'icon-card-body';
/** Prefix of the generated, size-derived class added to the card on export. */
export const SIZE_CLASS_PREFIX = 'icon-card--';

export type IconPosition = 'left' | 'right' | 'top';

/** Icon width (px) per breakpoint; Tablet/Desktop inherit when unset. */
export type IconSizes = { mobile: number } & Partial<Record<OverrideTier, number>>;

export interface CardLayout {
  position: IconPosition;
  sizes: IconSizes;
  /** Space between icon and content in px. */
  gap: number;
  valign: 'top' | 'middle' | 'bottom';
  /** Columns stack below the MJML breakpoint (no mj-group). */
  stack: boolean;
}

export const LAYOUT_PROPS = {
  position: 'card-position',
  sizeMobile: 'card-size-mobile',
  sizeTablet: 'card-size-tablet',
  sizeDesktop: 'card-size-desktop',
  gap: 'card-gap',
  valign: 'card-valign',
  stack: 'card-stack',
};

const SIZE_PROPS: Record<Tier, string> = {
  mobile: LAYOUT_PROPS.sizeMobile,
  tablet: LAYOUT_PROPS.sizeTablet,
  desktop: LAYOUT_PROPS.sizeDesktop,
};

export const DEFAULT_LAYOUT: CardLayout = { position: 'left', sizes: { mobile: 60 }, gap: 16, valign: 'middle', stack: false };
const DEFAULT_BODY_WIDTH = 600;

const classTokens = (cssClass: unknown) => String(cssClass || '').split(/\s+/).filter(Boolean);
export const hasCardClass = (cssClass: unknown) => classTokens(cssClass).includes(CARD_CLASS);
const hasClass = (cmp: Component, cls: string) => classTokens(cmp.getAttributes()['css-class']).includes(cls);

const px = (value: unknown): number => {
  const num = parseFloat(String(value ?? ''));
  return isFinite(num) ? num : 0;
};
/** Positive px value or `undefined` (empty = inherit). */
const optionalPx = (value: unknown) => (px(value) > 0 ? Math.round(px(value)) : undefined);

const typeOf = (cmp?: Component) => cmp?.get('type');

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

/**
 * Effective padding on one side. A longhand that only mirrors the type's
 * `style-default` (merged into the attributes on init) loses to an explicit
 * `padding` shorthand from the source.
 */
export function paddingSide(cmp: Component, side: Side): number {
  const attrs = cmp.getAttributes();
  const longhand = attrs[`padding-${side}`];
  const isDefault = longhand !== undefined && longhand === (cmp.get('style-default') || {})[`padding-${side}`];
  if (longhand !== undefined && longhand !== '' && !(isDefault && attrs.padding)) return px(longhand);
  const parts = String(attrs.padding || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 0;
  const [top, right = top, bottom = top, left = right] = parts;
  return px({ top, right, bottom, left }[side]);
}

/** Explicit longhands (they always win over merged defaults); clears the shorthand. */
const paddingAttrs = (values: Partial<Record<Side, number>>) => ({
  padding: '',
  ...Object.fromEntries(SIDES.map((side) => [`padding-${side}`, `${values[side] || 0}px`])),
});

/** All columns of the card, in DOM order (directly or inside an mj-group). */
export const getColumns = (card: Component): Component[] =>
  card.components().models.flatMap((child: Component) => {
    if (typeOf(child) === typeColumn) return [child];
    if (typeOf(child) === typeGroup) return child.components().filter((c: Component) => typeOf(c) === typeColumn);
    return [];
  });

/** Width available to the card's columns: body − wrapper padding − card padding. */
export function getInnerWidth(card: Component): number {
  let width = DEFAULT_BODY_WIDTH;
  const horizontal = (cmp: Component) => paddingSide(cmp, 'left') + paddingSide(cmp, 'right');
  let paddings = horizontal(card);
  let parent = card.parent();
  while (parent) {
    const parentType = typeOf(parent);
    if (parentType === typeWrapper) paddings += horizontal(parent);
    if (parentType === typeBody) {
      width = px(parent.getAttributes().width) || DEFAULT_BODY_WIDTH;
      break;
    }
    parent = parent.parent();
  }
  return Math.max(width - paddings, 0);
}

/** Index of the icon column: marked by class, else the narrowest one. */
const iconColumnIndex = (columns: Component[]) => {
  const marked = columns.findIndex((col) => hasClass(col, ICON_COL_CLASS));
  if (marked >= 0) return marked;
  const widths = columns.map((col) => px(col.getAttributes().width) || Infinity);
  return widths.indexOf(Math.min(...widths));
};

/** The card's icon image, if any. */
export function getIcon(card: Component): Component | undefined {
  const columns = getColumns(card);
  if (columns.length < 2) {
    const first = columns[0]?.components().at(0);
    return typeOf(first) === typeImage ? first : undefined;
  }
  return columns[iconColumnIndex(columns)].components().find((c: Component) => typeOf(c) === typeImage);
}

/** Icon sizes per breakpoint, read from the icon image. */
export function readSizes(icon?: Component): IconSizes {
  if (!icon) return { ...DEFAULT_LAYOUT.sizes };
  const overrides = getOverrides(icon);
  const sizes: IconSizes = { mobile: optionalPx(icon.getAttributes().width) || DEFAULT_LAYOUT.sizes.mobile };
  OVERRIDE_TIERS.forEach((tier) => {
    const value = optionalPx(overrides[tier]?.width);
    if (value) sizes[tier] = value;
  });
  return sizes;
}

/** Effective size on each breakpoint (inheritance resolved). */
export const effectiveSizes = (sizes: IconSizes): Record<Tier, number> => {
  const tablet = sizes.tablet || sizes.mobile;
  return { mobile: sizes.mobile, tablet, desktop: sizes.desktop || tablet };
};

/** Read the layout back from the children. */
export function deriveLayout(card: Component): CardLayout {
  const columns = getColumns(card);
  const hasGroup = card.components().some((c: Component) => typeOf(c) === typeGroup);
  const icon = getIcon(card);
  const sizes = readSizes(icon);

  if (columns.length < 2) {
    return { ...DEFAULT_LAYOUT, position: 'top', sizes, gap: icon ? paddingSide(icon, 'bottom') : 0, stack: !hasGroup };
  }

  const iconIndex = iconColumnIndex(columns);
  const iconCol = columns[iconIndex];
  const contentCol = columns[iconIndex === 0 ? 1 : 0];
  const position: IconPosition = iconIndex === 0 ? 'left' : 'right';
  const valign = (contentCol.getAttributes()['vertical-align'] || 'top') as CardLayout['valign'];

  return {
    position,
    sizes,
    gap: paddingSide(iconCol, position === 'left' ? 'right' : 'left'),
    valign: ['top', 'middle', 'bottom'].includes(valign) ? valign : 'top',
    stack: !hasGroup,
  };
}

const pct = (value: number) => `${Math.round(value * 100) / 100}%`;

/**
 * Fallback [icon, content] column widths (%) for an icon box of `iconPx`.
 * The icon share is rounded *up*: MJML sizes the image from the column box,
 * and rounding down (e.g. 9.33% of 600 = 55.98px) would shave a pixel off.
 */
export function columnWidths(card: Component, iconPx: number): [string, string] {
  const inner = getInnerWidth(card) || DEFAULT_BODY_WIDTH;
  const icon = Math.min(Math.max(Math.ceil((iconPx / inner) * 10000) / 100, 0), 100);
  return [pct(icon), pct(100 - icon)];
}

/** Write the icon sizes to the image: base width + Tablet/Desktop overrides. */
function writeSizes(icon: Component, sizes: IconSizes, base: Record<string, string>) {
  const overrides = { ...getOverrides(icon) };
  OVERRIDE_TIERS.forEach((tier) => {
    const { width, ...rest } = overrides[tier] || {};
    const next = sizes[tier] ? { ...rest, width: `${sizes[tier]}px` } : rest;
    if (Object.keys(next).length) overrides[tier] = next;
    else delete overrides[tier];
  });
  // One attribute update per component: consecutive `addAttributes` calls
  // can re-apply stale values through the core's style mirroring.
  icon.addAttributes({ ...base, width: `${sizes.mobile}px` });
  Object.keys(overrides).length ? icon.set(RESPONSIVE_PROP, overrides) : icon.unset(RESPONSIVE_PROP);
}

/**
 * Rebuild the card's structure for `layout`, moving (not cloning) the existing
 * icon and content components so their settings and overrides are kept.
 */
export function applyLayout(card: Component, layout: CardLayout) {
  const columns = getColumns(card);
  const current = deriveLayout(card);

  // Collect the icon and the content, in order.
  let icon: Component | undefined;
  let content: Component[] = [];
  if (current.position === 'top') {
    const children = columns.flatMap((col) => col.components().models.slice());
    icon = children[0] && typeOf(children[0]) === typeImage ? children[0] : undefined;
    content = children.filter((c) => c !== icon);
  } else {
    const iconIndex = iconColumnIndex(columns);
    columns.forEach((col, index) => {
      const children = col.components().models.slice();
      if (index === iconIndex) {
        icon = children.find((c) => typeOf(c) === typeImage);
        content.push(...children.filter((c) => c !== icon));
      } else {
        content.push(...children);
      }
    });
  }

  const sizes: IconSizes = { ...layout.sizes, mobile: Math.max(Math.round(layout.sizes.mobile), 1) };
  const gap = Math.max(Math.round(layout.gap), 0);

  // Detach the parts, then rebuild the card's children around them.
  const parts = [icon, ...content].filter(Boolean) as Component[];
  parts.forEach((part) => part.remove({ temporary: true } as any));
  card.components().reset();

  if (layout.position === 'top') {
    const column = card.components().add({ type: typeColumn, tagName: typeColumn }) as unknown as Component;
    icon && writeSizes(icon, sizes, paddingAttrs({ bottom: gap }));
    column.components().add(parts);
    return;
  }

  const container = layout.stack
    ? card
    : (card.components().add({ type: typeGroup, tagName: typeGroup }) as unknown as Component);
  const [iconWidth, contentWidth] = columnWidths(card, sizes.mobile + gap);
  // Components created from a type need an explicit MJML tag (parsed ones
  // get it from the source element).
  const iconCol = {
    type: typeColumn,
    tagName: typeColumn,
    attributes: {
      'css-class': ICON_COL_CLASS,
      width: iconWidth,
      'vertical-align': layout.valign,
      ...paddingAttrs({ [layout.position === 'left' ? 'right' : 'left']: gap }),
    },
  };
  const contentCol = {
    type: typeColumn,
    tagName: typeColumn,
    attributes: { 'css-class': BODY_COL_CLASS, width: contentWidth, 'vertical-align': layout.valign },
  };
  const added = container.components().add(layout.position === 'left' ? [iconCol, contentCol] : [contentCol, iconCol]) as unknown as Component[];
  const [iconColumn, contentColumn] = layout.position === 'left' ? added : [added[1], added[0]];
  if (icon) {
    writeSizes(icon, sizes, paddingAttrs({}));
    iconColumn.components().add(icon);
  }
  contentColumn.components().add(content);
}

/** Keep the fallback column widths right after padding/size changes. */
export function syncColumnWidths(card: Component) {
  const layout = deriveLayout(card);
  if (layout.position === 'top') return;
  const columns = getColumns(card);
  const iconIndex = iconColumnIndex(columns);
  const [iconWidth, contentWidth] = columnWidths(card, layout.sizes.mobile + layout.gap);
  const iconCol = columns[iconIndex];
  const contentCol = columns[iconIndex === 0 ? 1 : 0];
  iconCol && iconCol.getAttributes().width !== iconWidth && iconCol.addAttributes({ width: iconWidth });
  contentCol && contentCol.getAttributes().width !== contentWidth && contentCol.addAttributes({ width: contentWidth });
}

/** Icon column box (icon + gap) per breakpoint for a side-by-side card. */
const columnBoxes = (layout: CardLayout) => {
  const sizes = effectiveSizes(layout.sizes);
  return { mobile: sizes.mobile + layout.gap, tablet: sizes.tablet + layout.gap, desktop: sizes.desktop + layout.gap };
};

/** Size-derived class for the card (`icon-card--56-56-76`), '' when not needed. */
export function sizeClassName(layout: CardLayout): string {
  if (layout.position === 'top') return '';
  const box = columnBoxes(layout);
  return `${SIZE_CLASS_PREFIX}${layout.stack ? 's-' : ''}${box.mobile}-${box.tablet}-${box.desktop}`;
}

/** Per-breakpoint rules pinning the icon column and letting the content fill the rest. */
export function cardCss(layout: CardLayout): TierCss {
  const token = sizeClassName(layout);
  if (!token) return {};
  const box = columnBoxes(layout);
  const rules = (width: number) => [
    `.${token} .${ICON_COL_CLASS} { width: ${width}px !important; max-width: ${width}px !important; }`,
    `.${token} .${BODY_COL_CLASS} { width: calc(100% - ${width}px) !important; max-width: calc(100% - ${width}px) !important; }`,
  ];
  const css: TierCss = {};
  // Stacked on mobile: leave MJML's full-width columns alone there.
  if (!layout.stack) css.mobile = rules(box.mobile);
  if (layout.stack || box.tablet !== box.mobile) css.tablet = rules(box.tablet);
  if (box.desktop !== box.tablet) css.desktop = rules(box.desktop);
  return css;
}

/**
 * Tag the card's canvas element(s) with its size class: the canvas element
 * doesn't carry the compiled `css-class`, so the preview rules need it here.
 */
function syncPreviewClass(card: Component) {
  const token = sizeClassName(deriveLayout(card));
  ((card as any).views || []).forEach((view: any) => {
    const el: HTMLElement | undefined = view.el;
    if (!el?.classList) return;
    Array.from(el.classList)
      .filter((cls) => cls.startsWith(SIZE_CLASS_PREFIX) && cls !== token)
      .forEach((cls) => el.classList.remove(cls));
    token && el.classList.add(token);
  });
}

/** Remove generated size classes (from imported MJML); they're re-added on export. */
const withoutSizeClass = (cssClass: unknown) =>
  classTokens(cssClass).filter((cls) => !cls.startsWith(SIZE_CLASS_PREFIX)).join(' ');

export default (editor: Editor, _opts: ComponentPluginOptions) => {
  const t = (key: string, fallback: string) => {
    const res = editor.I18n.t(`grapesjs-mjml.iconCard.${key}`);
    return res && res !== `grapesjs-mjml.iconCard.${key}` ? res : fallback;
  };
  const opt = (id: string, name: string) => ({ id, value: id, name, label: name });
  const sectionType = editor.Components.getType(typeSection) as any;
  const sectionModel = sectionType.model.prototype;
  const sectionTraits = sectionModel.defaults.traits || [];
  const tierName = (tier: Tier) => editor.I18n.t(`grapesjs-mjml.responsive.tiers.${tier}`) as string;
  const sizeTrait = (tier: Tier) => ({
    type: 'number',
    label: tierName(tier),
    name: SIZE_PROPS[tier],
    changeProp: true,
    min: 1,
    units: ['px'],
    placeholder: tier === 'mobile' ? '' : t('inherit', 'inherit'),
  });

  editor.Components.addType(type, {
    extend: typeSection,
    isComponent: (el: Element) =>
      (el.tagName || '').toLowerCase() === typeSection && hasCardClass(el.getAttribute?.('css-class')),

    model: {
      defaults: {
        name: getName(editor, 'iconCard'),
        tagName: typeSection,
        traits: [
          groupTrait(t('groupLayout', 'Card layout'), 'card'),
          {
            type: 'select',
            label: t('position', 'Icon'),
            name: LAYOUT_PROPS.position,
            changeProp: true,
            options: [opt('left', 'Left'), opt('right', 'Right'), opt('top', 'Top')],
          },
          { type: 'number', label: t('gap', 'Gap'), name: LAYOUT_PROPS.gap, changeProp: true, min: 0, units: ['px'] },
          {
            type: 'select',
            label: t('valign', 'Align'),
            name: LAYOUT_PROPS.valign,
            changeProp: true,
            options: [opt('top', 'Top'), opt('middle', 'Middle'), opt('bottom', 'Bottom')],
          },
          { type: 'checkbox', label: t('stack', 'Stack on mobile'), name: LAYOUT_PROPS.stack, changeProp: true },
          groupTrait(t('groupSize', 'Icon size'), 'width'),
          sizeTrait('mobile'),
          sizeTrait('tablet'),
          sizeTrait('desktop'),
          groupTrait(t('groupSection', 'Section'), 'layout'),
          ...sectionTraits,
        ],
      },

      init() {
        sectionModel.init.call(this);
        // Always carry the marker class (even if created without it), never
        // a stale size class from imported MJML.
        const cssClass = this.getAttributes()['css-class'];
        const clean = withoutSizeClass(cssClass);
        const next = hasCardClass(clean) ? clean : [clean, CARD_CLASS].filter(Boolean).join(' ');
        next !== cssClass && this.addAttributes({ 'css-class': next }, { silent: true });
        this.readLayout();
        const props = Object.values(LAYOUT_PROPS).map((p) => `change:${p}`).join(' ');
        this.on(props, this.onLayoutChange);
        this.on('change:attributes', this.onCardAttrsChange);
      },

      /** Export/preview: add the size class scoping the generated column rules. */
      withResponsiveClass(attr: Record<string, any>) {
        const result = sectionModel.withResponsiveClass.call(this, attr);
        const token = sizeClassName(deriveLayout(this));
        if (token) result['css-class'] = [result['css-class'], token].filter(Boolean).join(' ');
        return result;
      },

      /** Mirror the derived layout into the (trait-bound) props. */
      readLayout() {
        const layout = deriveLayout(this);
        const values: Record<string, any> = {
          [LAYOUT_PROPS.position]: layout.position,
          [LAYOUT_PROPS.gap]: layout.gap,
          [LAYOUT_PROPS.valign]: layout.valign,
          [LAYOUT_PROPS.stack]: layout.stack,
          [LAYOUT_PROPS.sizeMobile]: layout.sizes.mobile,
          [LAYOUT_PROPS.sizeTablet]: layout.sizes.tablet ?? '',
          [LAYOUT_PROPS.sizeDesktop]: layout.sizes.desktop ?? '',
        };
        this.__applying = true;
        try {
          this.set(values);
        } finally {
          this.__applying = false;
        }
      },

      onLayoutChange() {
        if (this.__applying) return;
        const layout: CardLayout = {
          position: this.get(LAYOUT_PROPS.position) || DEFAULT_LAYOUT.position,
          sizes: {
            mobile: optionalPx(this.get(LAYOUT_PROPS.sizeMobile)) || DEFAULT_LAYOUT.sizes.mobile,
            tablet: optionalPx(this.get(LAYOUT_PROPS.sizeTablet)),
            desktop: optionalPx(this.get(LAYOUT_PROPS.sizeDesktop)),
          },
          gap: px(this.get(LAYOUT_PROPS.gap)),
          valign: this.get(LAYOUT_PROPS.valign) || DEFAULT_LAYOUT.valign,
          stack: !!this.get(LAYOUT_PROPS.stack),
        };
        this.__applying = true;
        try {
          applyLayout(this, layout);
        } finally {
          this.__applying = false;
        }
        this.readLayout();
        getResponsive(editor).trigger();
      },

      onCardAttrsChange() {
        if (this.__applying) return;
        // Padding may have changed: keep the fallback widths right.
        syncColumnWidths(this);
      },
    },

    view: {
      // Re-renders rebuild the element's classes: tag it again.
      onRender() {
        syncPreviewClass(this.model);
      },
    },
  });

  // Column rules for every side-by-side card (export <mj-style> + canvas
  // preview). Runs on every preview refresh, so it also re-tags the cards'
  // canvas elements when their sizes changed.
  getResponsive(editor).addCssProvider((root) => {
    const css: TierCss = {};
    (root?.findType(type) || []).forEach((card: Component) => {
      syncPreviewClass(card);
      const cardRules = cardCss(deriveLayout(card));
      (Object.keys(cardRules) as Tier[]).forEach((tier) => {
        css[tier] = [...(css[tier] || []), ...cardRules[tier]!];
      });
    });
    return css;
  });

  // The icon's size can also change from the image's own settings (Style
  // Manager, per breakpoint): refresh the card's fields when it's selected.
  editor.on('component:selected', (cmp: Component) => typeOf(cmp) === type && (cmp as any).readLayout());
};
