// Specs: https://documentation.mjml.io/#mj-attributes
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeHead } from './Head';
import { type as typeAll } from './All';
import { type as typeMjClass } from './MjClass';

export const type = 'mj-attributes';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'attributes'),
        draggable: componentsToQuery(typeHead),
        droppable: componentsToQuery([typeAll, typeMjClass]),
        highlightable: false,
        stylable: false,
        'style-default': {},
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
