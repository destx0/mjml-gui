// Specs: https://documentation.mjml.io/#mj-carousel-image
import type { Editor } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { componentsToQuery, getName, isComponentType } from './utils';
import { type as typeCarousel } from './Carousel';

export const type = 'mj-carousel-image';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    extend: 'image',
    model: {
      ...coreMjmlModel,
      defaults: {
        resizable: false,
        highlightable: false,
        name: getName(editor, 'carouselImage'),
        draggable: componentsToQuery(typeCarousel),
        stylable: [
          'border-radius',
          'thumbnails-src',
        ],
        'style-default': {},
        traits: ['src', 'href', 'rel', 'alt', 'title', 'thumbnails-src'],
        void: false,
      },
    },
    view: {
      ...coreMjmlView,
      tagName: 'div',
      attributes: {
        style: 'pointer-events: all; display: table; width: 100%; user-select: none;',
      },

      getMjmlTemplate() {
        let parentView = this.model.parent()?.view;
        // @ts-ignore
        if (parentView?.getInnerMjmlTemplate) {
          let mjmlCarousel = coreMjmlView.getInnerMjmlTemplate.call(parentView);
          return {
            start: `<mjml><mj-body><mj-column>${mjmlCarousel.start}`,
            end: `${mjmlCarousel.end}</mj-column></mj-body></mjml>`,
          };
        }
        return {
          start: `<mjml><mj-body><mj-column><mj-carousel>`,
          end: `</mj-carousel></mj-column></mj-body></mjml>`,
        };
      },

      getTemplateFromEl(sandboxEl: any) {
        return sandboxEl.innerHTML;
      },

      getChildrenSelector() {
        return 'img';
      },
    },
  });
};
