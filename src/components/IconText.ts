// Custom (non-standard MJML) component: fixed-width icon cell + auto-sized
// text cell. It is edited through traits (no code needed) and always
// serializes to standard MJML (mj-section > mj-column > mj-table), so the
// exported code compiles with any MJML compiler. Using attributes only (no
// raw HTML in the source) sidesteps browser shredding of <tr>/<td> content.
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeBody } from './Body';
import { type as typeWrapper } from './Wrapper';

export const type = 'mj-icon-text';

export const defaults: Record<string, string> = {
  'image-src': 'https://placehold.co/60x60',
  'icon-width': '60',
  'image-width': '60',
  'image-height': '60',
  'image-radius': '0',
  'title': 'Your money is invested in:',
  'title-size': '18',
  'title-color': '#28465f',
  'description': '${currentFundName}',
  'description-size': '24',
  'description-color': '#28465f',
  'description-bold': 'true',
};

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

/**
 * Build the standard MJML for the row from the component attributes.
 * Fixed icon cell (HTML width attribute, Outlook-safe) + auto text cell,
 * no percentages anywhere in the row.
 */
export function buildIconTextMjml(attrs: Record<string, any>): string {
  const a = { ...defaults, ...attrs };
  const radius = String(a['image-radius'] ?? '0').trim();
  const radiusStyle = radius && radius !== '0' ? `border-radius:${radius};` : '';
  const title = String(a['title'] ?? '').trim();
  const description = String(a['description'] ?? '').trim();
  const titleDiv = title
    ? `<div class="fs-18" style="font-family:Arial;font-size:${escapeAttr(a['title-size'])}px;font-weight:normal;line-height:30px;text-align:left;color:${escapeAttr(a['title-color'])};">${escapeText(title)}</div>`
    : '';
  const descDiv = description
    ? `<div class="fs-24" style="font-family:Arial;font-size:${escapeAttr(a['description-size'])}px;font-weight:${a['description-bold'] === 'true' ? 'bold' : 'normal'};line-height:30px;text-align:left;color:${escapeAttr(a['description-color'])};">${escapeText(description)}</div>`
    : '';

  return `<mj-section padding="0">` +
    `<mj-column padding="0" vertical-align="top">` +
    `<mj-table cellpadding="0" cellspacing="0" width="100%" table-layout="auto" padding="0" font-family="Arial" font-size="${escapeAttr(a['title-size'])}px" line-height="30px" color="${escapeAttr(a['title-color'])}">` +
    `<tr>` +
    `<td width="${escapeAttr(a['icon-width'])}" align="left" style="padding:6px 8px 6px 0;word-break:break-word;">` +
    `<img alt="" src="${escapeAttr(a['image-src'])}" width="${escapeAttr(a['image-width'])}" height="${escapeAttr(a['image-height'])}" style="border:0;display:block;outline:none;text-decoration:none;height:${escapeAttr(a['image-height'])}px;width:100%;font-size:13px;${radiusStyle}" />` +
    `</td>` +
    `<td align="left" style="padding:6px 24px 6px 0;word-break:break-word;">${titleDiv}${descDiv}</td>` +
    `</tr>` +
    `</mj-table>` +
    `</mj-column>` +
    `</mj-section>`;
}

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      toHTML() {
        // Export standard MJML only (never the custom tag), built live from
        // the current attributes so trait edits are always reflected.
        return buildIconTextMjml(this.get('attributes') || {});
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
          { type: 'text', label: 'Image src', name: 'image-src' },
          { type: 'number', label: 'Icon cell width', name: 'icon-width', min: 0 },
          { type: 'number', label: 'Image width', name: 'image-width', min: 0 },
          { type: 'number', label: 'Image height', name: 'image-height', min: 0 },
          { type: 'text', label: 'Image radius', name: 'image-radius' },
          { type: 'text', label: 'Title', name: 'title' },
          { type: 'number', label: 'Title size', name: 'title-size', min: 0 },
          { type: 'color', label: 'Title color', name: 'title-color' },
          { type: 'text', label: 'Description', name: 'description' },
          { type: 'number', label: 'Description size', name: 'description-size', min: 0 },
          { type: 'color', label: 'Description color', name: 'description-color' },
          {
            type: 'checkbox',
            label: 'Description bold',
            name: 'description-bold',
            valueTrue: 'true',
            valueFalse: 'false',
          },
        ],
      },
    },

    view: {
      ...coreMjmlView,
      tagName: 'div',
      attributes: {
        style: 'pointer-events: all;',
      },

      getMjmlTemplate() {
        return {
          start: `<mjml><mj-body>`,
          end: `</mj-body></mjml>`,
        };
      },

      getInnerMjmlTemplate() {
        // Preview compiles exactly what export produces.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attrs = (this.model as any).getMjmlAttributes();
        return { start: buildIconTextMjml(attrs), end: '' };
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
    },
  });
};
