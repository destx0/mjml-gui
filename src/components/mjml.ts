// Specs: https://documentation.mjml.io/#mjml
import type { Editor, ToHTMLOptions } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { isComponentType, componentsToQuery } from './utils';
import { type as typeHead } from './Head';
import { type as typeBody } from './Body';
import { getResponsive } from '../responsive';
import { type as typeIconCard } from './IconCard';

export const type = 'mjml';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,

      init() {
        coreMjmlModel.init.call(this);
        // Restore responsive overrides from imported/edited MJML source.
        getResponsive(editor).absorbMarkup(this);
        // Cards read their icon sizes before the overrides above were restored.
        this.findType(typeIconCard).forEach((card: any) => card.readLayout());
      },

      toHTML(opts: ToHTMLOptions) {
        return getResponsive(editor).injectExportStyle(coreMjmlModel.toHTML.call(this, opts), this);
      },

      defaults: {
        droppable: componentsToQuery([typeHead, typeBody]),
        draggable: false,
        stylable: false,
        copyable: false,
        removable: false,
        highlightable: false,
        traits: [
          {
            name: 'owa',
            placeholder: 'eg. desktop',
          },
          {
            name: 'lang',
            placeholder: 'eg. en',
          },
          {
            name: 'dir',
            placeholder: 'eg. rtl',
          },
        ],
      },
    },
    view: {
      ...coreMjmlView,
      tagName: 'div',
      attributes: { style: 'min-height: 100vh' },
      rerender() {
        this.render();
      },
      getTemplateFromMjml() {
        return '';
      }
    },
  });

};
