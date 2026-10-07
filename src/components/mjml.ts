// Specs: https://documentation.mjml.io/#mjml
import type { Editor, ToHTMLOptions } from 'grapesjs';
import { ComponentPluginOptions } from '.';
import { isComponentType, componentsToQuery } from './utils';
import { type as typeHead } from './Head';
import { type as typeBody } from './Body';
import { getResponsive } from '../responsive';
import { absorbIconText } from './IconText';

export const type = 'mjml';

export default (editor: Editor, { coreMjmlModel, coreMjmlView }: ComponentPluginOptions) => {
  editor.Components.addType(type, {
    isComponent: isComponentType(type),
    model: {
      ...coreMjmlModel,

      init() {
        coreMjmlModel.init.call(this);
        // Restore icon-text cards exported as standard MJML (+ meta comment).
        absorbIconText(this);
        // Restore responsive overrides from imported/edited MJML source.
        getResponsive(editor).absorbMarkup(this);
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
