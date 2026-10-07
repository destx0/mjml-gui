// Specs: https://documentation.mjml.io/#mj-carousel
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeColumn } from './Column';
import { type as typeCarouselImage } from './CarouselImage';

export const type = 'mj-carousel';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,
      defaults: {
        name: getName(editor, 'carousel'),
        draggable: componentsToQuery(typeColumn),
        droppable: componentsToQuery(typeCarouselImage),
        stylable: [
          'align',
          'container-background-color',
          'border-radius',
          'icon-width',
          'padding', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom',
          'tb-border', 'tb-border-radius', 'tb-hover-border-color', 'tb-selected-border-color', 'tb-width',
          'thumbnails',
        ],
        'style-default': {},
        traits: [
          'left-icon', 'right-icon',
        ],
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
        return 'td > div';
      },

      init() {
        coreMjmlView.init.call(this);
        this.listenTo(this.model.get('components'), 'add remove', this.render);
      },
    },
  });
};
