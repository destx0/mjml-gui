// Specs: https://documentation.mjml.io/#mj-accordion-title
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeAccordionElement } from './AccordionElement';

export const type = 'mj-accordion-title';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    extend: 'text',
    extendFnView: ['onActive'],
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'accordionTitle'),
        draggable: componentsToQuery(typeAccordionElement),
        highlightable: false,
        stylable: [
          'background-color', 'color',
          'font-family', 'font-size', 'font-weight', 'font-style',
          'padding', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom',
          'border', 'border-width', 'border-style', 'border-color',
        ],
        'style-default': {
          'font-size': '13px',
          'padding-top': '16px',
          'padding-bottom': '16px',
          'padding-right': '16px',
          'padding-left': '16px',
        },
      },
    },
    view: {
      ...coreMjmlView,
      tagName: 'tr',
      attributes: {
        style: 'pointer-events: all; display: table; width: 100%',
      },

      getMjmlTemplate() {
        return {
          start: `<mjml><mj-body><mj-column><mj-accordion><mj-accordion-element>`,
          end: `</mj-accordion-element></mj-accordion></mj-column></mj-body></mjml>`,
        };
      },

      getTemplateFromEl(sandboxEl: any) {
        return sandboxEl.querySelector('tr').innerHTML;
      },

      getChildrenSelector() {
        return 'td > div';
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
