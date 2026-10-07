// Specs: https://documentation.mjml.io/#mj-breakpoint
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeHead } from './Head';

export const type = 'mj-breakpoint';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'breakpoint'),
        draggable: componentsToQuery(typeHead),
        droppable: false,
        highlightable: false,
        stylable: ['width'],
        'style-default': {
          'width': '480px',
        },
      },
    },
    view: {
      ...coreMjmlView,
      tagName: 'div',
      attributes: {
        style: 'pointer-events: all; width: 100%; padding: 5px; background: #f5f5f5;',
      },

      getMjmlTemplate() {
        return {
          start: `<mjml><mj-head>`,
          end: `</mj-head><mj-body></mj-body></mjml>`,
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
