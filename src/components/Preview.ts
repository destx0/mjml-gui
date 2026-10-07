// Specs: https://documentation.mjml.io/#mj-preview
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeHead } from './Head';

export const type = 'mj-preview';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    extend: 'text',
    extendFnView: ['onActive'],
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'preview'),
        draggable: componentsToQuery(typeHead),
        highlightable: false,
        stylable: false,
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

      rerender() {
        this.render();
      },

      onActive() {
        this.getChildrenContainer().style.pointerEvents = 'all';
      },
    },
  });
};
