// Specs: https://documentation.mjml.io/#mj-table
import type { Editor, ToHTMLOptions } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { installRawTableParser } from './tableRawContent';
import { type as typeColumn } from './Column';
import { type as typeHero } from './Hero';

export const type = 'mj-table';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  // mj-table content is raw HTML: keep it opaque through string imports,
  // otherwise browser parsing shreds the <tr>/<td> structure on import.
  installRawTableParser(editor);

  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      toHTML(opts?: ToHTMLOptions) {
        // Emit the preserved raw content verbatim (see tableRawContent.ts).
        // Falling back to the default serialization would output the
        // shredded import children without any <tr>/<td> structure.
        const raw = this.get('rawContent');
        if (typeof raw === 'string') {
          const tag = this.get('tagName');
          const attr = this.getAttrToHTML();
          let strAttr = '';
          for (let prop in attr) {
            const val = attr[prop];
            const hasValue = typeof val !== 'undefined' && val !== '';
            strAttr += hasValue ? ` ${prop}="${val}"` : '';
          }
          return `<${tag}${strAttr}>${raw}</${tag}>`;
        }
        return coreMjmlModel.toHTML.call(this, opts);
      },
      defaults: {
        name: getName(editor, 'table'),
        draggable: componentsToQuery([typeColumn, typeHero]),
        // Table content is raw HTML (<tr><td>), not MJML components,
        // so disable drag-drop inside to avoid the stacked-blocks mistake.
        // Edit the table HTML via the code view / import.
        droppable: false,
        highlightable: false,
        stylable: [
          'align',
          'color',
          'font-family', 'font-size', 'font-weight', 'font-style',
          'line-height', 'letter-spacing',
          'padding', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom',
          'container-background-color',
          'border', 'border-width', 'border-style', 'border-color',
          'table-layout',
        ],
        'style-default': {
          'font-size': '13px',
          'color': '#000000',
          'line-height': '22px',
          'padding-top': '10px',
          'padding-bottom': '10px',
          'padding-right': '25px',
          'padding-left': '25px',
          'align': 'left',
        },
      },
    },

    view: {
      ...coreMjmlView,
      tagName: 'tr',
      attributes: {
        style: 'pointer-events: all; display: table; width: 100%; user-select: none;',
      },

      getMjmlTemplate() {
        return {
          start: `<mjml><mj-body><mj-column>`,
          end: `</mj-column></mj-body></mjml>`,
        };
      },

      getInnerMjmlTemplate() {
        const tmpl = coreMjmlView.getInnerMjmlTemplate.call(this);
        // Render the preserved raw content (see tableRawContent.ts) so the
        // canvas preview compiles exactly what export will produce.
        const raw = this.model.get('rawContent');
        if (typeof raw === 'string') {
          return { start: tmpl.start, end: `${raw}${tmpl.end}` };
        }
        return tmpl;
      },

      getTemplateFromEl(sandboxEl: any) {
        return sandboxEl.querySelector('tr').innerHTML;
      },

      // The compiled table HTML is complete as-is (raw content is opaque and
      // the model keeps no children by design). The default updateContent
      // would wipe the inner table (it clears the children container when the
      // model has no content), so it has to be a no-op here.
      updateContent() {},

      getChildrenSelector() {
        return 'table';
      },
    },
  });
};
