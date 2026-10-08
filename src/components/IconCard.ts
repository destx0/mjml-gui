// Icon card: a regular mj-section (marked with `css-class="icon-card"`) whose
// children are ordinary MJML components — an icon column holding an mj-image
// and a content column holding mj-text (and anything else dropped there).
// Every part is selected and edited like any other component (full Style
// Manager, rich text, per-breakpoint overrides). The card itself only adds
// layout settings — icon position, icon size, gap, vertical alignment and
// "stack on mobile" — which restructure the children in place.
//
// The layout is never stored separately: it's derived from the children, so
// imported/hand-written MJML with the marker class is recognised as is.
//
// Column widths are percentages computed from the available width. MJML
// turns px column widths into `width: Npx !important` above its breakpoint,
// which overflows (and wraps) on screens between the breakpoint and the body
// width; percentages don't, and Outlook still gets px from the body width.
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

export const type = 'mj-icon-card';
export const CARD_CLASS = 'icon-card';

export type IconPosition = 'left' | 'right' | 'top';

export interface CardLayout {
  position: IconPosition;
  /** Icon (image) width in px. */
  size: number;
  /** Space between icon and content in px. */
  gap: number;
  valign: 'top' | 'middle' | 'bottom';
  /** Columns stack below the MJML breakpoint (no mj-group). */
  stack: boolean;
}

export const LAYOUT_PROPS: Record<keyof CardLayout, string> = {
  position: 'card-position',
  size: 'card-icon-size',
  gap: 'card-gap',
  valign: 'card-valign',
  stack: 'card-stack',
};

export const DEFAULT_LAYOUT: CardLayout = { position: 'left', size: 60, gap: 16, valign: 'middle', stack: false };
const DEFAULT_BODY_WIDTH = 600;

export const hasCardClass = (cssClass: unknown) => String(cssClass || '').split(/\s+/).includes(CARD_CLASS);

const px = (value: unknown): number => {
  const num = parseFloat(String(value ?? ''));
  return isFinite(num) ? num : 0;
};

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

/** Read the layout back from the children. */
export function deriveLayout(card: Component): CardLayout {
  const columns = getColumns(card);
  const hasGroup = card.components().some((c: Component) => typeOf(c) === typeGroup);

  if (columns.length < 2) {
    const first = columns[0]?.components().at(0);
    const image = typeOf(first) === typeImage ? first : undefined;
    const gap = image ? paddingSide(image, 'bottom') : 0;
    return {
      ...DEFAULT_LAYOUT,
      position: 'top',
      size: px(image?.getAttributes().width) || DEFAULT_LAYOUT.size,
      gap,
      stack: !hasGroup,
    };
  }

  // The icon column is the narrowest one.
  const widths = columns.map((col) => px(col.getAttributes().width) || Infinity);
  const iconIndex = widths.indexOf(Math.min(...widths));
  const iconCol = columns[iconIndex];
  const contentCol = columns[iconIndex === 0 ? 1 : 0];
  const position: IconPosition = iconIndex === 0 ? 'left' : 'right';
  const image = iconCol.components().find((c: Component) => typeOf(c) === typeImage);
  const iconAttrs = iconCol.getAttributes();
  const gap = paddingSide(iconCol, position === 'left' ? 'right' : 'left');
  const valign = (contentCol.getAttributes()['vertical-align'] || 'top') as CardLayout['valign'];

  return {
    position,
    size: px(image?.getAttributes().width) || DEFAULT_LAYOUT.size,
    gap,
    valign: ['top', 'middle', 'bottom'].includes(valign) ? valign : 'top',
    stack: !hasGroup,
  };
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
    const widths = columns.map((col) => px(col.getAttributes().width) || Infinity);
    const iconIndex = widths.indexOf(Math.min(...widths));
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

  const size = Math.max(Math.round(layout.size), 0);
  const gap = Math.max(Math.round(layout.gap), 0);
  // One attribute update per component: consecutive `addAttributes` calls
  // can re-apply stale values through the core's style mirroring.
  const iconAttrs = (padding: Partial<Record<Side, number>>) => ({ width: `${size}px`, ...paddingAttrs(padding) });

  // Detach the parts, then rebuild the card's children around them.
  const parts = [icon, ...content].filter(Boolean) as Component[];
  parts.forEach((part) => part.remove({ temporary: true } as any));
  card.components().reset();

  if (layout.position === 'top') {
    const column = card.components().add({ type: typeColumn, tagName: typeColumn }) as unknown as Component;
    icon?.addAttributes(iconAttrs({ bottom: gap }));
    column.components().add(parts);
    return;
  }

  const container = layout.stack
    ? card
    : (card.components().add({ type: typeGroup, tagName: typeGroup }) as unknown as Component);
  const [iconWidth, contentWidth] = columnWidths(card, size + gap);
  // Components created from a type need an explicit MJML tag (parsed ones
  // get it from the source element).
  const iconCol = {
    type: typeColumn,
    tagName: typeColumn,
    attributes: {
      width: iconWidth,
      'vertical-align': layout.valign,
      ...paddingAttrs({ [layout.position === 'left' ? 'right' : 'left']: gap }),
    },
  };
  const contentCol = {
    type: typeColumn,
    tagName: typeColumn,
    attributes: { width: contentWidth, 'vertical-align': layout.valign },
  };
  const added = container.components().add(layout.position === 'left' ? [iconCol, contentCol] : [contentCol, iconCol]) as unknown as Component[];
  const [iconColumn, contentColumn] = layout.position === 'left' ? added : [added[1], added[0]];
  if (icon) {
    icon.addAttributes(iconAttrs({}));
    iconColumn.components().add(icon);
  }
  contentColumn.components().add(content);
}

const pct = (value: number) => `${Math.round(value * 100) / 100}%`;

/** [icon, content] column widths (percentages) for an icon box of `iconPx`. */
export function columnWidths(card: Component, iconPx: number): [string, string] {
  const inner = getInnerWidth(card) || DEFAULT_BODY_WIDTH;
  const icon = Math.min(Math.max((iconPx / inner) * 100, 0), 100);
  return [pct(icon), pct(100 - icon)];
}

/** Keep the icon column's share right after padding/width changes. */
export function syncColumnWidths(card: Component) {
  const layout = deriveLayout(card);
  if (layout.position === 'top') return;
  const columns = getColumns(card);
  const [iconWidth, contentWidth] = columnWidths(card, layout.size + layout.gap);
  const [iconCol, contentCol] = layout.position === 'left' ? columns : [columns[1], columns[0]];
  iconCol && iconCol.getAttributes().width !== iconWidth && iconCol.addAttributes({ width: iconWidth });
  contentCol && contentCol.getAttributes().width !== contentWidth && contentCol.addAttributes({ width: contentWidth });
}

export default (editor: Editor, _opts: ComponentPluginOptions) => {
  const t = (key: string, fallback: string) => {
    const res = editor.I18n.t(`grapesjs-mjml.iconCard.${key}`);
    return res && res !== `grapesjs-mjml.iconCard.${key}` ? res : fallback;
  };
  const opt = (id: string, name: string) => ({ id, value: id, name, label: name });
  const sectionType = editor.Components.getType(typeSection) as any;
  const sectionTraits = sectionType.model.prototype.defaults.traits || [];

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
          { type: 'number', label: t('size', 'Icon size'), name: LAYOUT_PROPS.size, changeProp: true, min: 0, units: ['px'] },
          { type: 'number', label: t('gap', 'Gap'), name: LAYOUT_PROPS.gap, changeProp: true, min: 0, units: ['px'] },
          {
            type: 'select',
            label: t('valign', 'Align'),
            name: LAYOUT_PROPS.valign,
            changeProp: true,
            options: [opt('top', 'Top'), opt('middle', 'Middle'), opt('bottom', 'Bottom')],
          },
          { type: 'checkbox', label: t('stack', 'Stack on mobile'), name: LAYOUT_PROPS.stack, changeProp: true },
          groupTrait(t('groupSection', 'Section'), 'layout'),
          ...sectionTraits,
        ],
      },

      init() {
        sectionType.model.prototype.init.call(this);
        // Always carry the marker class, even if created without it.
        const cssClass = this.getAttributes()['css-class'];
        if (!hasCardClass(cssClass)) {
          this.addAttributes({ 'css-class': [cssClass, CARD_CLASS].filter(Boolean).join(' ') }, { silent: true });
        }
        this.readLayout();
        const props = Object.values(LAYOUT_PROPS).map((p) => `change:${p}`).join(' ');
        this.on(props, this.onLayoutChange);
        this.on('change:attributes', this.onCardAttrsChange);
      },

      /** Mirror the derived layout into the (trait-bound) props, silently. */
      readLayout() {
        const layout = deriveLayout(this);
        (Object.keys(LAYOUT_PROPS) as (keyof CardLayout)[]).forEach((key) => {
          this.set(LAYOUT_PROPS[key], layout[key], { silent: true });
        });
      },

      onLayoutChange() {
        if (this.__applying) return;
        const layout: CardLayout = {
          position: this.get(LAYOUT_PROPS.position) || DEFAULT_LAYOUT.position,
          size: px(this.get(LAYOUT_PROPS.size)),
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
      },

      onCardAttrsChange() {
        if (this.__applying) return;
        // Padding may have changed: keep the icon column's share right.
        syncColumnWidths(this);
      },
    },
  });
};
