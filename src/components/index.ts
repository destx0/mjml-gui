import type { Editor, ToHTMLOptions } from 'grapesjs';
import { mjmlConvert, debounce, componentsToQuery } from './utils';
import loadMjml from './mjml';
import loadHead from './Head';
import loadStyle from './Style';
import loadFont from './Font';
import loadBody from './Body';
import loadWrapper from './Wrapper';
import loadSection from './Section';
import loadGroup from './Group';
import loadColumn from './Column';
import loadText from './Text';
import loadButton from './Button';
import loadImage from './Image';
import loadTable from './Table';
import loadAccordion from './Accordion';
import loadAccordionElement from './AccordionElement';
import loadAccordionTitle from './AccordionTitle';
import loadAccordionText from './AccordionText';
import loadCarousel from './Carousel';
import loadCarouselImage from './CarouselImage';
import loadAttributes from './Attributes';
import loadAll from './All';
import loadMjClass from './MjClass';
import loadBreakpoint from './Breakpoint';
import loadPreview from './Preview';
import loadTitle from './Title';
import loadSocial from './Social';
import loadSocialElement from './SocialElement';
import loadDivider from './Divider';
import loadSpacer from './Spacer';
import loadNavBar from './NavBar';
import loadNavBarLink from './NavBarLink';
import loadHero from './Hero';
import loadIconCard from './IconCard';
import loadRaw from './Raw';
import { RequiredPluginOptions, PluginOptions } from '..';
import { RESPONSIVE_PROP, getOverrides, getResponsive } from '../responsive';

export type ComponentPluginOptions = {
  /**
   * Core model, which can be extended
   */
  coreMjmlModel: any;
  /**
   * Core view, which can be extended
   */
  coreMjmlView: any;
  opt: Required<PluginOptions>;
  sandboxEl: HTMLDivElement;
  componentsToQuery: typeof componentsToQuery;
};

export default (editor: Editor, opt: RequiredPluginOptions) => {
  const { Components } = editor;
  // @ts-ignore
  const ComponentsView = Components.ComponentsView;
  const sandboxEl = document.createElement('div');

  const responsive = getResponsive(editor);
  const BaseModel = Components.getType('default')!.model.prototype as any;

  // MJML Core model.
  // Styles and MJML attributes are the same thing here: `style` mirrors
  // `attributes`, which hold the base (mobile) tier. While the Style Manager
  // edits a Tablet/Desktop tier, `getStyle`/`setStyle` read and write that
  // tier's overrides instead (see `responsive/`).
  let coreMjmlModel = {
    init() {
      const own = { ...this.get('style'), ...this.get('attributes') };
      const defaults = { ...this.get('style-default') };
      // A `padding` shorthand from the source must not be shadowed by the
      // type's default longhands (MJML lets longhands win), otherwise e.g.
      // `<mj-image padding="0">` previews with the default 25px sides.
      if (own.padding !== undefined && own.padding !== '') {
        ['top', 'right', 'bottom', 'left'].forEach((side) => {
          if (!(`padding-${side}` in own)) delete defaults[`padding-${side}`];
        });
      }
      const attrs = { ...defaults, ...own };
      this.set('attributes', attrs);
      this.set('style', attrs);
      // Undo restores a snapshot with `set()`, which can't remove keys the
      // snapshot lacks: keep the key around so the first override is undoable.
      if (!(RESPONSIVE_PROP in this.attributes)) this.attributes[RESPONSIVE_PROP] = undefined;
      this.listenTo(this, 'change:style', this.handleStyleChange);
      this.listenTo(this, 'change:attributes', this.handleAttributeChange);
    },

    getStyle(...args: any[]) {
      const tier = responsive.editingTier(this);
      if (!tier) return BaseModel.getStyle.apply(this, args);
      const style = { ...getOverrides(this)[tier] };
      return typeof args[0] === 'string' && args[0] ? style[args[0]] : style;
    },

    setStyle(prop: any = {}, opts: any = {}) {
      const tier = responsive.editingTier(this);
      if (!tier) return BaseModel.setStyle.call(this, prop, opts);
      const style = typeof prop === 'string' ? this.parseStyle(prop) : { ...prop };
      responsive.setTierStyle(this, tier, style, opts);
      return style;
    },

    /**
     * `addAttributes` merges in `getAttributes()`, which carries a `style`
     * string serialized from the *previous* values. The core then parses it
     * back with `setStyle`, which (style mirrors attributes here) reverts the
     * update. MJML attributes never need an inline `style`, so drop it.
     */
    setAttributes(attrs: Record<string, any> = {}, opts: any = {}) {
      const { style, ...rest } = attrs;
      this.set('attributes', rest, opts);
      return this;
    },

    handleAttributeChange(m: any, v: any, opts: any) {
      BaseModel.setStyle.call(this, this.get('attributes'), opts);
    },

    getStylesToAttributes() {
      const { __p, ...style } = this.get('style') || {};
      return style;
    },

    handleStyleChange(m: any, v: any, opts: any) {
      this.set('attributes', this.getStylesToAttributes(), opts);
    },

    /** Add the responsive class token (if any) to MJML attributes. */
    withResponsiveClass(attr: Record<string, any>) {
      const token = responsive.classNameFor(this);
      if (token) attr['css-class'] = [attr['css-class'], token].filter(Boolean).join(' ');
      return attr;
    },

    getMjmlAttributes() {
      const { style, ...attr } = this.get('attributes') || {};
      const src = this.get('src');
      if (src) attr.src = src;
      return this.withResponsiveClass(attr);
    },

    /**
     * This will avoid rendering default attributes
     * @return {Object}
     */
    getAttrToHTML() {
      const { style, id, ...attr } = this.get('attributes') || {};
      const defaults = this.get('style-default') || {};

      for (let prop in attr) {
        const value = attr[prop];
        if (value && value === defaults[prop]) delete attr[prop];
      }

      return this.withResponsiveClass(attr);
    },

    /**
     * Have to change a few things for the MJML's xml (no id, style, class)
     */
    toHTML(opts: ToHTMLOptions) {
      const tag = this.get('tagName');
      const voidTag = this.get('void');
      const attr = this.getAttrToHTML();
      let strAttr = '';

      for (let prop in attr) {
        const val = attr[prop];
        strAttr += typeof val !== 'undefined' && val !== '' ? ` ${prop}="${val}"` : '';
      }

      let code = `<${tag}${strAttr}${voidTag ? '/' : ''}>` + this.get('content');
      this.components().forEach((model: any) => {
        code += model.toHTML(opts);
      });

      return voidTag ? code : `${code}</${tag}>`;
    },

    isHidden() {
      return (this.get('style') || {}).display === 'none';
    },
  } as any;

  /**
   * MJML Core View.
   * MJML is designed to compile from a valid MJML document therefore any time we update some component
   * we have to recompile its MJML to HTML.
   *
   * To get the proper HTML of our updated component we have to build a new MJML document and here we can
   * find different helpers to accomplish that (eg. `getMjmlTemplate`, `getInnerMjmlTemplate`).
   *
   * Once the MJML is compiled (in `getTemplateFromMjml`) we have to extract its HTML from the
   * element (`getTemplateFromEl`).
   *
   * We should also instruct the editor to understand where new inner components are placed in our compiled
   * HTML once they are dropped inside, for that case you can rely on `getChildrenSelector` in your
   * component definition.
   *
   * Each MJML element differs in its output HTML structure and might also change based on inner components
   * (you might need to change `getMjmlTemplate` based on current inner Components).
   *
   * One easy way to test the HTML output is to use MJML live editor (https://mjml.io/try-it-live) with the
   * "View HTML" enabled and check there how it changes in order to override properly provided helpers.
   *
   */
  let coreMjmlView = {
    init() {
      this.stopListening(this.model, 'change:style');
      this.listenTo(this.model, 'change:attributes change:src', this.rerender);
      this.listenTo(this.model, `change:${RESPONSIVE_PROP}`, this.onResponsiveChange);
      this.debouncedRender = debounce(this.render.bind(this), 0);
    },

    /**
     * Override values are previewed through the canvas stylesheet; only
     * re-render when the class token appears or disappears.
     */
    onResponsiveChange() {
      const { model } = this;
      const had = !!Object.keys(model.previous(RESPONSIVE_PROP) || {}).length;
      const has = !!Object.keys(getOverrides(model)).length;
      had !== has && this.rerender();
    },

    rerender() {
      this.render(null, null, {}, 1);
    },

    /**
     * Get the base MJML template wrapper tags
     */
    getMjmlTemplate() {
      return {
        start: `<mjml>`,
        end: `</mjml>`,
      };
    },

    /**
     * Build the MJML of the current component
     */
    getInnerMjmlTemplate() {
      const { model } = this;
      const tagName = model.get('tagName');
      const attr = model.getMjmlAttributes();
      let strAttr = '';

      for (let prop in attr) {
        const val = attr[prop];
        strAttr += typeof val !== 'undefined' && val !== '' ? ' ' + prop + '="' + val + '"' : '';
      }

      return {
        start: `<${tagName}${strAttr}>`,
        end: `</${tagName}>`,
      };
    },

    /**
     * Get the proper HTML string from the element containing compiled MJML template.
     */
    getTemplateFromEl(sandboxEl: any) {
      return sandboxEl.firstChild.innerHTML;
    },

    /**
     * Get HTML from MJML template.
     */
    getTemplateFromMjml() {
      const mjmlTmpl = this.getMjmlTemplate();
      const innerMjml = this.getInnerMjmlTemplate();
      const mjml = `${mjmlTmpl.start}${innerMjml.start}${innerMjml.end}${mjmlTmpl.end}`;
      const htmlOutput = mjmlConvert(opt.mjmlParser, mjml, opt.fonts);
      let html = htmlOutput.html;
      html = html.replace(/<body(.*)>/, '<body>');
      let start = html.indexOf('<body>') + 6;
      let end = html.indexOf('</body>');
      html = html.substring(start, end).trim();
      sandboxEl.innerHTML = html;
      return this.getTemplateFromEl(sandboxEl);
    },

    /**
     * Render children components
     * @private
     */
    renderChildren(appendChildren: boolean) {
      this.updateContent();
      const container = this.getChildrenContainer();

      // This trick will help perfs by caching children
      if (!appendChildren) {
        this.childrenView =
          this.childrenView ||
          // @ts-ignore
          new ComponentsView({
            collection: this.model.get('components'),
            // @ts-ignore
            config: this.config,
            componentTypes: this.opts.componentTypes,
          });
        this.childNodes = this.childrenView.render(container).el.childNodes;
      } else {
        this.childrenView.parentEl = container;
      }

      const childNodes = Array.prototype.slice.call(this.childNodes);

      for (let i = 0, len = childNodes.length; i < len; i++) {
        container.appendChild(childNodes.shift());
      }
    },

    checkVisibility() {
      if (this.model.isHidden?.()) {
        this.el.style.display = 'none';
      }
    },

    renderStyle() {
      this.el.style.cssText = this.attributes.style;
      this.checkVisibility();
    },

    render(p: any, c: any, opts: any, appendChildren: boolean) {
      this.renderAttributes();
      this.el.innerHTML = this.getTemplateFromMjml();
      this.renderChildren(appendChildren);
      this.childNodes = this.getChildrenContainer().childNodes;
      this.renderStyle();
      this.postRender();

      return this;
    },
  } as any;

  // MJML Internal view (for elements inside mj-columns)
  const compOpts = { coreMjmlModel, coreMjmlView, opt, sandboxEl, componentsToQuery };

  // Avoid the <body> tag from the default wrapper
  editor.Components.addType('wrapper', {
    model: {
      defaults: {
        highlightable: false,
      },
      toHTML(opts: any) {
        return this.getInnerHTML(opts)!;
      },
    },
  });

  [
    loadMjml,
    loadHead,
    loadStyle,
    loadFont,
    loadBody,
    loadWrapper,
    loadSection,
    loadGroup,
    loadColumn,
    loadButton,
    loadText,
    loadImage,
    loadTable,
    loadAccordion,
    loadAccordionElement,
    loadAccordionTitle,
    loadAccordionText,
    loadCarousel,
    loadCarouselImage,
    loadAttributes,
    loadAll,
    loadMjClass,
    loadBreakpoint,
    loadPreview,
    loadTitle,
    loadSocial,
    loadSocialElement,
    loadDivider,
    loadSpacer,
    loadNavBar,
    loadNavBarLink,
    loadHero,
    loadIconCard,
    loadRaw,
    ...opt.customComponents,
  ].forEach((module) => module(editor, compOpts));
};
