// Specs: https://documentation.mjml.io/#mj-table
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { installRawTableParser } from './tableRawContent';
import { type as typeColumn } from './Column';
import { type as typeHero } from './Hero';

export const type = 'mj-table';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  // mj-table content is raw HTML (<tr>/<td>): parse it in a table context so
  // it becomes editable row/cell components instead of shredded fragments
  // (see tableRawContent.ts). Export serializes the live children back.
  installRawTableParser(editor);

  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'table'),
        draggable: componentsToQuery([typeColumn, typeHero]),
        // Rows/cells inside are editable components (text, image, styles);
        // the table itself only accepts MJML-level drops, like before.
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

      getTemplateFromEl(sandboxEl: any) {
        return sandboxEl.querySelector('tr').innerHTML;
      },

      getChildrenSelector() {
        return 'table';
      },
    },
  });
};
