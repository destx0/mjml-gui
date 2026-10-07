// Specs: https://documentation.mjml.io/#mj-accordion
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeColumn } from './Column';
import { type as typeAccordionElement } from './AccordionElement';

export const type = 'mj-accordion';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'accordion'),
        draggable: componentsToQuery(typeColumn),
        droppable: componentsToQuery(typeAccordionElement),
        stylable: [
          'container-background-color',
          'border', 'border-width', 'border-style', 'border-color',
          'font-family',
          'icon-align', 'icon-height', 'icon-position', 'icon-width',
          'padding', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom',
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
          start: `<mjml><mj-body>`,
          end: `</mj-body></mjml>`,
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
