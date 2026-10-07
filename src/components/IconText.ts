// Custom (non-standard MJML) component: icon/image + title + description.
// It is edited entirely from the UI (grouped traits, inline text editing on
// the canvas, Asset Manager image picker) and always serializes to standard
// MJML (mj-section > mj-column > mj-table), so the exported code compiles with
// any MJML compiler. Using attributes only (no raw HTML in the source)
// sidesteps browser shredding of <tr>/<td> content.
//
// Round-trip: the export is preceded by a `<!-- mj-icon-text {json} -->`
// comment holding the attributes, so importing the MJML (or editing it in the
// code dock) turns the section back into an editable icon-text component.
import type { Component, Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeBody } from './Body';
import { type as typeWrapper } from './Wrapper';
import { type as typeSection } from './Section';
import { groupTrait, pickImage, traitImagePicker } from '../traits';

export const type = 'mj-icon-text';

/** Comment marker preceding the exported section. */
export const META_PREFIX = 'mj-icon-text ';

// NB: no empty-string defaults. The core mirrors attributes into an inline
// style string that drops empty values, and that mismatch makes
// `addAttributes` re-apply stale values (trait/inline edits get lost).
// Optional attributes (alt, href, background, border…) are simply absent.
export const defaults: Record<string, string> = {
  'image-src': 'https://placehold.co/60x60',
  'icon-position': 'left',
  'icon-width': '60',
  'image-width': '60',
  'image-height': '60',
  'image-radius': '0',
  'gap': '8',
  'vertical-align': 'middle',
  'title': 'Your money is invested in:',
  'title-size': '18',
  'title-color': '#28465f',
  'title-bold': 'false',
  'description': '${currentFundName}',
  'description-size': '24',
  'description-color': '#28465f',
  'description-bold': 'true',
  'font-family': 'Arial',
  'line-height': '30',
  'text-align': 'left',
  'padding': '0',
};

/** Attributes that hold inline-editable text on the canvas. */
export const textFields = ['title', 'description'];

const escapeAttr = (value: any) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeText = (value: any) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Bare numbers are pixels; anything else (`50%`, `1em`) is kept as is. */
const px = (value: any) => {
  const str = String(value ?? '').trim();
  return /^-?\d+(\.\d+)?$/.test(str) ? `${str}px` : str;
};

const num = (value: any) => parseFloat(String(value ?? '')) || 0;

export interface BuildOptions {
  /** Add `data-it-field` markers used by the canvas for inline editing. */
  preview?: boolean;
}

/**
 * Build the standard MJML for the card from the component attributes.
 * Fixed icon cell (HTML width attribute, Outlook-safe) + auto text cell,
 * no percentages anywhere in the row.
 */
export function buildIconTextMjml(attrs: Record<string, any>, opts: BuildOptions = {}): string {
  const a = { ...defaults, ...attrs };
  const marker = (field: string) => (opts.preview ? ` data-it-field="${field}"` : '');
  const position = ['left', 'right', 'top'].includes(a['icon-position']) ? a['icon-position'] : 'left';
  const valign = ['top', 'middle', 'bottom'].includes(a['vertical-align']) ? a['vertical-align'] : 'middle';
  const align = ['left', 'center', 'right'].includes(a['text-align']) ? a['text-align'] : 'left';
  const gap = num(a['gap']);
  const font = escapeAttr(a['font-family'] || defaults['font-family']);
  const lineHeight = px(a['line-height'] || defaults['line-height']);
  const href = String(a['href'] ?? '').trim();
  const link = (inner: string) =>
    href ? `<a href="${escapeAttr(href)}" target="_blank" style="color:inherit;text-decoration:none;">${inner}</a>` : inner;

  const radius = String(a['image-radius'] ?? '0').trim();
  const radiusStyle = radius && radius !== '0' ? `border-radius:${escapeAttr(px(radius))};` : '';
  const imgWidth = position === 'top' ? `${escapeAttr(px(a['image-width']))};display:inline-block` : '100%;display:block';
  const src = String(a['image-src'] ?? '').trim();
  const img = src
    ? link(
        `<img${marker('image')} alt="${escapeAttr(a['image-alt'])}" src="${escapeAttr(src)}" width="${escapeAttr(a['image-width'])}" height="${escapeAttr(a['image-height'])}" style="border:0;outline:none;text-decoration:none;height:${escapeAttr(a['image-height'])}px;width:${imgWidth};font-size:13px;${radiusStyle}" />`,
      )
    : '';

  const textStyle = (size: any, color: any, bold: any) =>
    `font-family:${font};font-size:${escapeAttr(size)}px;font-weight:${bold === 'true' ? 'bold' : 'normal'};line-height:${escapeAttr(lineHeight)};text-align:${align};color:${escapeAttr(color)};`;
  const title = String(a['title'] ?? '').trim();
  const description = String(a['description'] ?? '').trim();
  const titleDiv = title
    ? `<div class="fs-18"${marker('title')} style="${textStyle(a['title-size'], a['title-color'], a['title-bold'])}">${link(escapeText(title))}</div>`
    : '';
  const descDiv = description
    ? `<div class="fs-24"${marker('description')} style="${textStyle(a['description-size'], a['description-color'], a['description-bold'])}">${escapeText(description)}</div>`
    : '';

  const iconWidth = escapeAttr(a['icon-width']);
  let rows: string;
  if (position === 'top') {
    rows =
      (img ? `<tr><td align="${align}" style="padding:6px 0 ${gap}px 0;word-break:break-word;">${img}</td></tr>` : '') +
      `<tr><td align="${align}" style="padding:0 0 6px 0;word-break:break-word;">${titleDiv}${descDiv}</td></tr>`;
  } else {
    const iconCell = img
      ? `<td width="${iconWidth}" align="left" valign="${valign}" style="padding:${position === 'left' ? `6px ${gap}px 6px 0` : `6px 0 6px ${gap}px`};vertical-align:${valign};word-break:break-word;">${img}</td>`
      : '';
    const textCell = `<td align="${align}" valign="${valign}" style="padding:${position === 'left' ? '6px 24px 6px 0' : '6px 0'};vertical-align:${valign};word-break:break-word;">${titleDiv}${descDiv}</td>`;
    rows = `<tr>${position === 'left' ? iconCell + textCell : textCell + iconCell}</tr>`;
  }

  const sectionAttrs = [
    `padding="${escapeAttr(a['padding'] || '0')}"`,
    a['background-color'] && `background-color="${escapeAttr(a['background-color'])}"`,
    a['border-radius'] && `border-radius="${escapeAttr(px(a['border-radius']))}"`,
    a['border'] && `border="${escapeAttr(a['border'])}"`,
  ].filter(Boolean).join(' ');

  return `<mj-section ${sectionAttrs}>` +
    `<mj-column padding="0" vertical-align="top">` +
    `<mj-table cellpadding="0" cellspacing="0" width="100%" table-layout="auto" padding="0" font-family="${font}" font-size="${escapeAttr(a['title-size'])}px" line-height="${escapeAttr(lineHeight)}" color="${escapeAttr(a['title-color'])}">` +
    rows +
    `</mj-table>` +
    `</mj-column>` +
    `</mj-section>`;
}

/** Attributes worth persisting in the round-trip comment. */
const metaAttrs = (attrs: Record<string, any>) => {
  const out: Record<string, string> = {};
  Object.keys(attrs).forEach((key) => {
    const value = attrs[key];
    if (key === 'id' || key === 'style' || key.startsWith('__') || value === undefined || value === null) return;
    out[key] = String(value);
  });
  return out;
};

/** `<!-- mj-icon-text {json} -->`; `--` can't appear inside a comment. */
export const buildMetaComment = (attrs: Record<string, any>) =>
  `<!-- ${META_PREFIX}${JSON.stringify(metaAttrs(attrs)).replace(/--/g, '-\\u002d')} -->`;

export const parseMetaComment = (content: string): Record<string, string> | null => {
  const text = String(content || '').trim();
  if (!text.startsWith(META_PREFIX)) return null;
  try {
    const data = JSON.parse(text.slice(META_PREFIX.length));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
};

/**
 * Turn `<!-- mj-icon-text {...} -->` + following `<mj-section>` pairs (from an
 * MJML import / code dock edit) back into icon-text components.
 */
export function absorbIconText(root: Component) {
  const pairs: [Component, Component, Record<string, string>][] = [];
  root.forEachChild((cmp: Component) => {
    if (cmp.get('type') !== 'comment') return;
    const attrs = parseMetaComment(cmp.get('content') || '');
    if (!attrs) return;
    const coll = cmp.collection;
    const siblings = coll.models;
    let next = siblings[coll.indexOf(cmp) + 1];
    // Skip whitespace-only text nodes between the comment and the section.
    for (let i = coll.indexOf(cmp) + 1; next && next.get('type') === 'textnode' && !String(next.get('content') || '').trim(); i++) {
      next = siblings[i + 1];
    }
    if (next && next.get('type') === typeSection) pairs.push([cmp, next, attrs]);
  });

  pairs.forEach(([comment, section, attrs]) => {
    const coll = section.collection;
    const at = coll.indexOf(section);
    section.remove();
    comment.remove();
    coll.add({ type, attributes: attrs }, { at });
  });
}

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  const t = (key: string, fallback: string) => {
    const res = editor.I18n.t(`grapesjs-mjml.iconText.${key}`);
    return res && res !== `grapesjs-mjml.iconText.${key}` ? res : fallback;
  };
  const opt = (id: string, name: string) => ({ id, value: id, name, label: name });

  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,

      // Absent == empty for every option here. Dropping empty values (and the
      // mirrored inline `style` string) keeps attributes and style in sync,
      // see the note on `defaults`.
      setAttributes(attrs: Record<string, any>, opts: any = {}) {
        const { style, ...rest } = attrs || {};
        Object.keys(rest).forEach((key) => (rest[key] === '' || rest[key] == null) && delete rest[key]);
        this.set('attributes', rest, opts);
        return this;
      },

      toHTML() {
        // Export standard MJML only (never the custom tag), built live from
        // the current attributes so trait edits are always reflected.
        const attrs = this.get('attributes') || {};
        return buildMetaComment(attrs) + buildIconTextMjml(attrs);
      },
      defaults: {
        name: getName(editor, 'iconText'),
        tagName: type,
        draggable: componentsToQuery([typeBody, typeWrapper]),
        droppable: false,
        highlightable: true,
        stylable: false,
        void: true,
        attributes: { ...defaults },
        traits: [
          groupTrait(t('groupIcon', 'Icon'), 'image'),
          { type: traitImagePicker, label: t('image', 'Image'), name: 'image-src' },
          { type: 'text', label: t('alt', 'Alt text'), name: 'image-alt' },
          {
            type: 'select',
            label: t('position', 'Position'),
            name: 'icon-position',
            options: [opt('left', 'Left'), opt('right', 'Right'), opt('top', 'Top')],
          },
          { type: 'number', label: t('imageWidth', 'Width'), name: 'image-width', min: 0 },
          { type: 'number', label: t('imageHeight', 'Height'), name: 'image-height', min: 0 },
          { type: 'number', label: t('iconWidth', 'Cell width'), name: 'icon-width', min: 0 },
          {
            type: 'select',
            label: t('radius', 'Shape'),
            name: 'image-radius',
            options: [opt('0', 'Square'), opt('8px', 'Rounded'), opt('50%', 'Circle')],
          },

          groupTrait(t('groupTitle', 'Title'), 'heading'),
          { type: 'text', label: t('text', 'Text'), name: 'title' },
          { type: 'number', label: t('size', 'Size'), name: 'title-size', min: 0 },
          { type: 'color', label: t('color', 'Color'), name: 'title-color' },
          { type: 'checkbox', label: t('bold', 'Bold'), name: 'title-bold', valueTrue: 'true', valueFalse: 'false' },

          groupTrait(t('groupDescription', 'Description'), 'text'),
          { type: 'text', label: t('text', 'Text'), name: 'description' },
          { type: 'number', label: t('size', 'Size'), name: 'description-size', min: 0 },
          { type: 'color', label: t('color', 'Color'), name: 'description-color' },
          { type: 'checkbox', label: t('bold', 'Bold'), name: 'description-bold', valueTrue: 'true', valueFalse: 'false' },

          groupTrait(t('groupLayout', 'Layout'), 'layout'),
          {
            type: 'select',
            label: t('align', 'Text align'),
            name: 'text-align',
            options: [opt('left', 'Left'), opt('center', 'Center'), opt('right', 'Right')],
          },
          {
            type: 'select',
            label: t('valign', 'Vertical'),
            name: 'vertical-align',
            options: [opt('top', 'Top'), opt('middle', 'Middle'), opt('bottom', 'Bottom')],
          },
          { type: 'number', label: t('gap', 'Gap'), name: 'gap', min: 0 },
          {
            type: 'select',
            label: t('font', 'Font'),
            name: 'font-family',
            options: [
              opt('Arial', 'Arial'),
              opt('Helvetica, Arial, sans-serif', 'Helvetica'),
              opt('Verdana, Geneva, sans-serif', 'Verdana'),
              opt('Tahoma, Geneva, sans-serif', 'Tahoma'),
              opt('Trebuchet MS, Helvetica, sans-serif', 'Trebuchet'),
              opt('Georgia, serif', 'Georgia'),
              opt('Times New Roman, Times, serif', 'Times'),
              opt('Courier New, Courier, monospace', 'Courier'),
            ],
          },
          { type: 'number', label: t('lineHeight', 'Line height'), name: 'line-height', min: 0 },

          groupTrait(t('groupCard', 'Card'), 'card'),
          { type: 'color', label: t('background', 'Background'), name: 'background-color' },
          { type: 'text', label: t('padding', 'Padding'), name: 'padding', placeholder: 'eg. 16px 20px' },
          { type: 'text', label: t('border', 'Border'), name: 'border', placeholder: 'eg. 1px solid #e5e7eb' },
          { type: 'text', label: t('cornerRadius', 'Corners'), name: 'border-radius', placeholder: 'eg. 8px' },

          groupTrait(t('groupLink', 'Link'), 'link'),
          { type: 'text', label: t('href', 'URL'), name: 'href', placeholder: 'https://…' },
        ],
      },
    },

    view: {
      ...coreMjmlView,
      tagName: 'div',
      attributes: {
        style: 'pointer-events: all;',
      },

      init() {
        coreMjmlView.init.call(this);
        // Delegated on the root, which survives re-renders (innerHTML swaps).
        this.el.addEventListener('dblclick', (ev: MouseEvent) => this.onFieldDblClick(ev));
      },

      getMjmlTemplate() {
        return {
          start: `<mjml><mj-body>`,
          end: `</mj-body></mjml>`,
        };
      },

      getInnerMjmlTemplate() {
        // Preview compiles exactly what export produces (plus edit markers).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attrs = (this.model as any).getMjmlAttributes();
        return { start: buildIconTextMjml(attrs, { preview: true }), end: '' };
      },

      getChildrenSelector() {
        return 'table';
      },

      getChildrenContainer() {
        // No child components by design: use a detached container so the
        // default children bookkeeping (which re-appends previously rendered
        // nodes on re-render) can never touch — or duplicate — the compiled
        // output. See renderChildren/updateContent below.
        return document.createElement('div');
      },

      // The preview is compiled opaquely from the attributes and the model
      // keeps no children by design. The default updateContent would wipe the
      // compiled tables (it clears the children container when the model has
      // no content), so it has to be a no-op here.
      updateContent() {},

      /** Double-click: edit title/description in place, or pick a new image. */
      onFieldDblClick(ev: MouseEvent) {
        const target = (ev.target as HTMLElement)?.closest?.('[data-it-field]') as HTMLElement | null;
        if (!target) return;
        ev.preventDefault();
        ev.stopPropagation();
        const { model } = this;
        const field = target.getAttribute('data-it-field')!;
        editor.select(model);

        if (field === 'image') {
          pickImage(editor, (src) => model.addAttributes({ 'image-src': src }));
          return;
        }
        if (textFields.includes(field)) this.startInlineEdit(target, field);
      },

      startInlineEdit(el: HTMLElement, field: string) {
        const { model } = this;
        const original = String(model.getAttributes()[field] ?? '');
        // Edit the raw value (not a link wrapper or escaped HTML).
        el.textContent = original;
        el.setAttribute('contenteditable', 'true');
        el.style.outline = '2px solid #3b97e3';
        el.style.outlineOffset = '2px';
        el.style.cursor = 'text';
        el.focus();
        // Select all so typing replaces the value (not available everywhere).
        const doc = el.ownerDocument;
        const sel = doc.getSelection?.();
        if (sel && doc.createRange) {
          const range = doc.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
        }

        let done = false;
        const finish = (commit: boolean) => {
          if (done) return;
          done = true;
          el.removeEventListener('keydown', onKey);
          el.removeEventListener('blur', onBlur);
          el.removeAttribute('contenteditable');
          const value = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (commit && value !== original) {
            model.addAttributes({ [field]: value });
          } else {
            this.rerender();
          }
        };
        const onKey = (e: KeyboardEvent) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          }
        };
        const onBlur = () => finish(true);
        el.addEventListener('keydown', onKey);
        el.addEventListener('blur', onBlur);
      },
    },
  });
};
