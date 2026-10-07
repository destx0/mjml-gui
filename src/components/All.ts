// Specs: https://documentation.mjml.io/#mj-all (inside mj-attributes)
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeAttributes } from './Attributes';

export const type = 'mj-all';

const commonAttributes = [
  'font-family', 'font-size', 'font-weight', 'font-style',
  'color', 'line-height', 'letter-spacing', 'text-decoration', 'text-transform',
  'align', 'vertical-align',
  'padding', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom',
  'background-color', 'container-background-color',
  'border', 'border-width', 'border-style', 'border-color', 'border-radius',
];

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'all'),
        draggable: componentsToQuery(typeAttributes),
        droppable: false,
        highlightable: false,
        stylable: commonAttributes,
        'style-default': {},
      },
    },
    view: {
      ...coreMjmlView,
      tagName: 'div',
      attributes: {
        style: 'pointer-events: all; width: 100%; padding: 5px;',
      },

      getMjmlTemplate() {
        return {
          start: `<mjml><mj-head><mj-attributes>`,
          end: `</mj-attributes></mj-head><mj-body></mj-body></mjml>`,
        };
      },

      getTemplateFromEl(sandboxEl: any) {
        return sandboxEl.innerHTML;
      },

      getChildrenSelector() {
        return 'div';
      },
    },
  });
};
