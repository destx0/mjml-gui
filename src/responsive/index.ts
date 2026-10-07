import type { Component, Editor } from 'grapesjs';
import type { RequiredPluginOptions } from '..';
import {
  Breakpoints,
  OverrideTier,
  Tier,
  cascadeFor,
  isOverrideTier,
  normalizeBreakpoints,
  previewWidthFor,
  sameBreakpoints,
  tierForWidth,
} from './breakpoints';
import {
  RESPONSIVE_CLASS_PREFIX,
  ResponsiveEntry,
  buildExportCss,
  buildPreviewCss,
  cleanOverrides,
  parseMeta,
} from './css';
import { supportsResponsive, supportsResponsiveProperty } from './targets';
import { BREAKPOINTS_PROP, RESPONSIVE_PROP, evResponsiveUpdate, getOverrides } from './props';
import mountResponsiveUi from './ui';

export * from './breakpoints';
export * from './props';
export { supportsResponsive, supportsResponsiveProperty } from './targets';


/** Device used to preview each tier (ids of GrapesJS' default devices). */
const TIER_DEVICES: Record<Tier, { id: string; name: string }> = {
  mobile: { id: 'mobilePortrait', name: 'Mobile portrait' },
  tablet: { id: 'tablet', name: 'Tablet' },
  desktop: { id: 'desktop', name: 'Desktop' },
};

export type ResponsiveController = ReturnType<typeof createController>;

const controllers = new WeakMap<Editor, ResponsiveController>();

/** Responsive controller of an editor (created by the plugin). */
export function getResponsive(editor: Editor): ResponsiveController {
  let ctrl = controllers.get(editor);
  if (!ctrl) {
    ctrl = createController(editor, {});
    controllers.set(editor, ctrl);
  }
  return ctrl;
}

const parsePx = (value: unknown): number | null => {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const responsiveClassName = (cmp: Component) => `${RESPONSIVE_CLASS_PREFIX}${cmp.cid}`;

const hasOverrides = (cmp: Component) =>
  supportsResponsive(cmp.get('type')!) && Object.keys(getOverrides(cmp)).length > 0;

/** Text content of a component (e.g. `<mj-style>`), without HTML escaping. */
const rawText = (cmp: Component): string =>
  (cmp.get('content') || '') + cmp.components().map((child: Component) => rawText(child)).join('');

function createController(editor: Editor, opts: RequiredPluginOptions['responsive']) {
  const defaults = normalizeBreakpoints(opts.breakpoints);
  /** True while the Style Manager reads/writes styles (see `patchStyleManager`). */
  let smScope = false;

  // `Components?.`: debounced Style Manager updates may land after destroy.
  const getRoot = (): Component | undefined => editor.Components?.getWrapper()?.findType('mjml')[0];

  const getBreakpoints = (root = getRoot()): Breakpoints =>
    normalizeBreakpoints(root?.get(BREAKPOINTS_PROP), defaults);

  const getTier = (): Tier => {
    // Optional chaining: debounced Style Manager updates may land after destroy.
    const device = editor.Devices?.getSelected();
    return tierForWidth(parsePx(device?.get('width')), getBreakpoints());
  };

  const trigger = () => editor.trigger(evResponsiveUpdate);

  return {
    getTier,
    getBreakpoints,
    getRoot,
    trigger,

    /** Switch the canvas to the device that previews `tier`. */
    setTier(tier: Tier) {
      const { id, name } = TIER_DEVICES[tier];
      const device = editor.Devices.get(id) || editor.Devices.get(name);
      device ? editor.Devices.select(device) : editor.setDevice(name);
    },

    setBreakpoints(input: Partial<Breakpoints>) {
      const root = getRoot();
      const next = normalizeBreakpoints({ ...getBreakpoints(root), ...input }, defaults);
      if (!root || sameBreakpoints(next, getBreakpoints(root))) return;
      root.set(BREAKPOINTS_PROP, sameBreakpoints(next, defaults) ? undefined : next);
    },

    resetBreakpoints() {
      getRoot()?.unset(BREAKPOINTS_PROP);
    },

    defaultBreakpoints: () => defaults,

    /** Fit the tier preview devices inside the current breakpoints. */
    syncDevices() {
      const bp = getBreakpoints();
      (['mobile', 'tablet'] as Tier[]).forEach((tier) => {
        const { id, name } = TIER_DEVICES[tier];
        const device = editor.Devices.get(id) || editor.Devices.get(name);
        device?.set({ width: `${previewWidthFor(tier, bp)}px`, widthMedia: '' });
      });
    },

    /**
     * Override tier the Style Manager is editing right now for `cmp`,
     * `null` when it edits the base (mobile) attributes.
     */
    editingTier(cmp: Component): OverrideTier | null {
      if (!smScope || !supportsResponsive(cmp.get('type')!)) return null;
      const tier = getTier();
      return isOverrideTier(tier) ? tier : null;
    },

    withStyleManagerScope<T>(fn: () => T): T {
      const prev = smScope;
      smScope = true;
      try {
        return fn();
      } finally {
        smScope = prev;
      }
    },

    /** Values a tier inherits: base attributes + lower override tiers. */
    inheritedStyle(cmp: Component, tier: OverrideTier): Record<string, string> {
      const { style, id, ...base } = cmp.get('attributes') || {};
      const overrides = getOverrides(cmp);
      return cascadeFor(tier)
        .filter((t) => t !== tier)
        .reduce((acc, t) => ({ ...acc, ...overrides[t] }), base);
    },

    setTierStyle(cmp: Component, tier: OverrideTier, style: Record<string, any>, setOpts: any = {}) {
      const prev = getOverrides(cmp);
      const next = cleanOverrides({ ...prev, [tier]: style });
      next ? cmp.set(RESPONSIVE_PROP, next, setOpts) : cmp.unset(RESPONSIVE_PROP, setOpts);

      // Mirror core `setStyle` events so the Style Manager refreshes.
      const before = prev[tier] || {};
      const after = next?.[tier] || {};
      const em = (cmp as any).em;
      Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
        .filter((prop) => before[prop] !== after[prop])
        .forEach((prop) => {
          cmp.trigger(`change:style:${prop}`);
          em?.trigger('styleable:change', cmp, prop, setOpts);
          em?.trigger(`styleable:change:${prop}`, cmp, prop, setOpts);
        });
    },

    /** Class token for `css-class`, empty when the component has no overrides. */
    classNameFor: (cmp: Component) => (hasOverrides(cmp) ? responsiveClassName(cmp) : ''),

    collectEntries(root = getRoot()): ResponsiveEntry[] {
      const entries: ResponsiveEntry[] = [];
      root?.forEachChild((cmp: Component) => {
        if (hasOverrides(cmp)) {
          entries.push({ type: cmp.get('type')!, className: responsiveClassName(cmp), overrides: getOverrides(cmp) });
        }
      });
      return entries;
    },

    previewCss(): string {
      return buildPreviewCss(this.collectEntries(), getTier());
    },

    /** Add the generated `<mj-style>` to exported MJML of `root`. */
    injectExportStyle(mjml: string, root: Component): string {
      const css = buildExportCss(this.collectEntries(root), getBreakpoints(root));
      if (!css) return mjml;
      const style = `<mj-style>\n${css}\n</mj-style>`;
      if (mjml.includes('</mj-head>')) return mjml.replace('</mj-head>', `${style}</mj-head>`);
      return mjml.replace(/^<mjml[^>]*>/, (open) => `${open}<mj-head>${style}</mj-head>`);
    },

    /**
     * Restore overrides from a generated `<mj-style>` (import, code dock),
     * then drop that block and the class tokens — they're regenerated on export.
     */
    absorbMarkup(root: Component) {
      const head = root.components().filter((cmp: Component) => cmp.get('type') === 'mj-head')[0];
      head
        ?.components()
        .filter((cmp: Component) => cmp.get('type') === 'mj-style')
        .forEach((styleCmp: Component) => {
          const meta = parseMeta(rawText(styleCmp));
          if (!meta) return;

          if (!sameBreakpoints(meta.breakpoints, defaults)) root.set(BREAKPOINTS_PROP, meta.breakpoints);

          root.forEachChild((cmp: Component) => {
            const cssClass: string = cmp.getAttributes()['css-class'] || '';
            const tokens = cssClass.split(/\s+/).filter(Boolean);
            const own = tokens.filter((token) => token.startsWith(RESPONSIVE_CLASS_PREFIX));
            if (!own.length) return;
            const overrides = own.map((token) => meta.overrides[token]).filter(Boolean)[0];
            overrides && cmp.set(RESPONSIVE_PROP, overrides);
            const rest = tokens.filter((token) => !own.includes(token)).join(' ');
            rest ? cmp.addAttributes({ 'css-class': rest }) : cmp.removeAttributes(['css-class']);
          });

          styleCmp.remove();
        });
    },
  };
}

/** Wire the Style Manager: tier-aware reads/writes + inherited values. */
function patchStyleManager(editor: Editor, ctrl: ResponsiveController) {
  const sm = editor.StyleManager as any;

  ['select', '__upProps', 'addStyleTargets'].forEach((method) => {
    const orig = sm[method].bind(sm);
    sm[method] = (...args: any[]) => ctrl.withStyleManagerScope(() => orig(...args));
  });

  // Inherited tier values are shown as "parent" values, so GrapesJS' own UI
  // marks them as inherited and only real overrides get the clear (×) icon.
  const getParentRules = sm.getParentRules.bind(sm);
  sm.getParentRules = (target: any, opts: any) => {
    const cmp = opts?.component || target;
    const tier = cmp?.get && ctrl.editingTier(cmp);
    if (!tier) return getParentRules(target, opts);
    return [{ getStyle: () => ctrl.inheritedStyle(cmp, tier) }];
  };

  // Hide properties that can't be overridden at the current tier.
  const upProps = sm.__upProps;
  sm.__upProps = (...args: any[]) => {
    upProps(...args);
    const cmp = sm.model.get('component');
    const tier = ctrl.getTier();
    if (!cmp || !isOverrideTier(tier)) return;
    const type = cmp.get('type');

    sm.getSectors().forEach((sector: any) => {
      const props = sector.getProperties();
      props.forEach((prop: any) => {
        if (prop.isVisible() && !supportsResponsiveProperty(type, prop.getName())) {
          prop.set('visible', false);
        }
      });
      sector.set('visible', props.some((prop: any) => prop.isVisible()));
    });
  };
}

/** Keep `<style>` with the tier preview rules inside the canvas frame. */
function syncCanvasPreview(editor: Editor, ctrl: ResponsiveController) {
  const STYLE_ID = 'mjml-responsive-preview';
  const update = () => {
    const doc = editor.Canvas.getDocument();
    if (!doc?.head) return;
    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }
    const css = ctrl.previewCss();
    if (style.textContent !== css) style.textContent = css;
  };
  let pending = 0;
  const schedule = () => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      update();
    });
  };
  editor.on(`frame:load device:select device:update component:remove ${evResponsiveUpdate}`, schedule);
  editor.on(`component:update:${RESPONSIVE_PROP} component:update:${BREAKPOINTS_PROP}`, schedule);
  update();
}

/**
 * Responsive styles: mobile-first base attributes plus Tablet/Desktop
 * overrides exported as `min-width` media queries.
 */
export default function loadResponsive(editor: Editor, opts: RequiredPluginOptions) {
  const ctrl = createController(editor, opts.responsive);
  controllers.set(editor, ctrl);

  patchStyleManager(editor, ctrl);

  const refreshStyleManager = () => (editor.StyleManager as any).select(editor.getSelectedAll());

  // Breakpoints (edited, or arriving with a new template) move the tier
  // preview devices, and so maybe the current tier.
  const onBreakpoints = () => {
    ctrl.syncDevices();
    refreshStyleManager();
    ctrl.trigger();
  };
  ctrl.syncDevices();
  editor.on(`component:update:${BREAKPOINTS_PROP}`, onBreakpoints);
  editor.on('component:add', (cmp: Component) => cmp.get('type') === 'mjml' && onBreakpoints());
  // Base attributes changed while editing a tier → refresh inherited values.
  editor.on('component:update:attributes', (cmp: Component) => {
    if (isOverrideTier(ctrl.getTier()) && editor.getSelectedAll().includes(cmp)) refreshStyleManager();
  });
  editor.on('device:select', () => ctrl.trigger());

  editor.onReady(() => {
    // Start on the base tier unless a custom canvas width was restored.
    const { startTier } = opts.responsive;
    const device = editor.Devices.getSelected();
    if (startTier && device?.id === TIER_DEVICES.desktop.id) ctrl.setTier(startTier);
    syncCanvasPreview(editor, ctrl);
    mountResponsiveUi(editor, ctrl);
  });
}

