// Specs: https://documentation.mjml.io/#mj-accordion-element
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeAccordion } from './Accordion';
import { type as typeAccordionTitle } from './AccordionTitle';
import { type as typeAccordionText } from './AccordionText';

export const type = 'mj-accordion-element';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'accordionElement'),
        draggable: componentsToQuery(typeAccordion),
        droppable: componentsToQuery([typeAccordionTitle, typeAccordionText]),
        stylable: [
          'background-color',
          'border', 'border-width', 'border-style', 'border-color',
          'icon-align', 'icon-height', 'icon-position', 'icon-width',
        ],
        'style-default': {},
        traits: [
          'icon-wrapped-url', 'icon-wrapped-alt',
          'icon-unwrapped-url', 'icon-unwrapped-alt',
        ],
      },
    },
    view: {
      ...coreMjmlView,
      tagName: 'div',
      attributes: {
        style: 'pointer-events: all; display: table; width: 100%',
      },

      getMjmlTemplate() {
        return {
          start: `<mjml><mj-body><mj-column><mj-accordion>`,
          end: `</mj-accordion></mj-column></mj-body></mjml>`,
        };
      },

      getChildrenSelector() {
        return 'div';
      },

      init() {
        coreMjmlView.init.call(this);
        this.listenTo(this.model.get('components'), 'add remove', this.render);
      },
    },
  });
};
