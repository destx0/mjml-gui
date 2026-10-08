// Top bar device control — the single place to switch what the canvas
// previews (and so which responsive tier the Style Manager edits):
//
//   [ ▯ Mobile | ▭ Tablet | ▭ Desktop ]  [ ↔ 482 px ▾ ]  [ ⊟ ]
//     segmented tier switch               width chip     breakpoints
//     (sliding highlight, override dots)  + presets menu  popover
//
// The highlighted tier always follows the canvas width, so a custom width
// (typed, picked from presets or dragged with the canvas grips) lights up
// the tier it falls into.
import type { Component, Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { uiIcon } from './icons';
import { Tier, TIERS, isOverrideTier, tierForWidth } from './responsive/breakpoints';
import { RESPONSIVE_PROP, evResponsiveUpdate, getOverrides } from './responsive/props';
import { createBreakpointEditor } from './responsive/ui';
import { getResponsive } from './responsive';
import { getCurrentCanvasWidth, setCustomWidth } from './canvasResize';

const CLS = 'mjd';

/** `Element.toggleAttribute` (missing in older DOMs, e.g. the test jsdom). */
const toggleAttr = (node: Element, name: string, on: boolean) =>
  on ? node.setAttribute(name, '') : node.removeAttribute(name);

/** Width presets in the chip's menu. */
export const WIDTH_PRESETS: { width: number; key: string }[] = [
  { width: 320, key: 'smallPhone' },
  { width: 375, key: 'phone' },
  { width: 414, key: 'largePhone' },
  { width: 600, key: 'email' },
  { width: 768, key: 'tablet' },
  { width: 1024, key: 'laptop' },
  { width: 1280, key: 'desktop' },
];

const STYLES = `
.${CLS}, .${CLS}-pop {
  /* Popovers live in <body> (outside the bar): they need the tokens too. */
  --mjd-track: rgba(0, 0, 0, 0.28);
  --mjd-line: rgba(255, 255, 255, 0.08);
  --mjd-hover: rgba(255, 255, 255, 0.07);
  --mjd-thumb: rgba(255, 255, 255, 0.13);
  --mjd-menu: #232429;
}
.${CLS} {
  display: flex; align-items: center; gap: 8px; height: 100%;
  font-size: 12px; line-height: 1; user-select: none; white-space: nowrap;
}
.${CLS} button { font: inherit; color: inherit; }
.${CLS} svg { width: 16px; height: 16px; flex: none; }

/* Segmented tier switch */
.${CLS}-seg {
  position: relative; display: flex; padding: 3px; gap: 2px;
  background: var(--mjd-track); border-radius: 9px; box-shadow: inset 0 0 0 1px var(--mjd-line);
}
.${CLS}-thumb {
  position: absolute; top: 3px; bottom: 3px; left: 0; width: 0; border-radius: 6px;
  background: var(--mjd-thumb); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), inset 0 0 0 1px var(--mjd-line);
  transition: transform 0.22s cubic-bezier(.3,.7,.3,1), width 0.22s cubic-bezier(.3,.7,.3,1);
  pointer-events: none;
}
.${CLS}-thumb[data-instant] { transition: none; }
.${CLS}-tier {
  position: relative; z-index: 1; display: flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 10px; border: 0; border-radius: 6px; background: none;
  cursor: pointer; opacity: 0.62; transition: opacity 0.15s, background 0.15s;
}
.${CLS}-tier:hover { opacity: 0.95; }
.${CLS}-tier:not([aria-checked="true"]):hover { background: var(--mjd-hover); }
.${CLS}-tier[aria-checked="true"] { opacity: 1; }
.${CLS}-tier:focus-visible, .${CLS}-chip:focus-within, .${CLS}-icon-btn:focus-visible {
  outline: 2px solid rgba(59, 151, 227, 0.8); outline-offset: 1px;
}
.${CLS}-tier-name { font-weight: 600; letter-spacing: 0.01em; }
.${CLS}-dot {
  position: absolute; top: 4px; right: 4px; width: 5px; height: 5px; border-radius: 50%;
  background: currentColor; display: none;
}
.${CLS}-tier[data-overridden] .${CLS}-dot { display: block; }

/* Width chip */
.${CLS}-chip {
  display: flex; align-items: center; height: 32px; padding: 0 2px 0 9px; gap: 6px;
  background: var(--mjd-track); border-radius: 9px; box-shadow: inset 0 0 0 1px var(--mjd-line);
}
.${CLS}-chip > svg { opacity: 0.55; }
.${CLS}-width {
  width: 42px; padding: 0; border: 0; outline: 0; background: none; color: inherit;
  font: inherit; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right;
}
.${CLS}-unit { opacity: 0.45; font-size: 11px; margin-left: -3px; }
.${CLS}-icon-btn {
  display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border: 0; border-radius: 7px; background: none; cursor: pointer; opacity: 0.7;
  transition: opacity 0.15s, background 0.15s;
}
.${CLS}-icon-btn:hover, .${CLS}-icon-btn[aria-expanded="true"] { opacity: 1; background: var(--mjd-hover); }
.${CLS}-bp-btn { width: 32px; height: 32px; background: var(--mjd-track); box-shadow: inset 0 0 0 1px var(--mjd-line); border-radius: 9px; }

/* Popovers (presets menu, breakpoints) */
.${CLS}-pop {
  position: fixed; z-index: 1000; min-width: 220px; padding: 6px;
  background: #232429; background: var(--mjd-menu); color: #ddd; border-radius: 10px;
  font-family: Helvetica, Arial, sans-serif; /* the editor's font; popovers sit outside it */
  font-size: 12px; line-height: 1; user-select: none; white-space: nowrap;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), inset 0 0 0 1px var(--mjd-line);
  opacity: 0; transform: translateY(-4px); transition: opacity 0.14s, transform 0.14s;
}
.${CLS}-pop[data-open] { opacity: 1; transform: none; }
.${CLS}-pop[hidden] { display: none; }
.${CLS}-pop-bp { width: 300px; padding: 0; }
.${CLS}-pop button { font: inherit; color: inherit; }
.${CLS}-pop svg { width: 16px; height: 16px; flex: none; }
.${CLS}-preset {
  display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 10px; width: 100%;
  padding: 8px 10px; border: 0; border-radius: 6px; background: none; cursor: pointer; text-align: left;
}
.${CLS}-preset:hover, .${CLS}-preset:focus-visible { background: var(--mjd-hover); outline: none; }
.${CLS}-preset[aria-current="true"] { background: var(--mjd-thumb); }
.${CLS}-preset-name { opacity: 0.9; }
.${CLS}-preset-px { font-variant-numeric: tabular-nums; opacity: 0.55; }
.${CLS}-preset svg { opacity: 0.7; }

/* Narrow windows: drop labels first, then the chip's icon. */
@media (max-width: 1180px) {
  .${CLS}-tier-name { display: none; }
  .${CLS}-tier { padding: 0 9px; }
}
@media (max-width: 820px) {
  .${CLS} { gap: 5px; }
  .${CLS}-chip > svg, .${CLS}-unit { display: none; }
  .${CLS}-chip { padding-left: 7px; }
}
`;

const ensureStyles = () => {
  if (typeof document === 'undefined' || document.querySelector(`style[data-${CLS}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(`data-${CLS}`, '');
  style.textContent = STYLES;
  document.head.appendChild(style);
};

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = '') => {
  const node = document.createElement(tag);
  Object.keys(attrs).forEach((name) => node.setAttribute(name, attrs[name]));
  if (html) node.innerHTML = html;
  return node;
};

export interface DeviceBar {
  el: HTMLElement;
  render(): void;
  destroy(): void;
}

/** Build the device bar (not mounted). */
export function createDeviceBar(editor: Editor, opts: RequiredPluginOptions): DeviceBar {
  const ctrl = getResponsive(editor);
  const pfx = editor.getConfig().stylePrefix || 'gjs-';
  const t = (key: string, params?: Record<string, any>) =>
    editor.I18n.t(`grapesjs-mjml.deviceBar.${key}`, { params }) as string;
  const tierName = (tier: Tier) => editor.I18n.t(`grapesjs-mjml.responsive.tiers.${tier}`) as string;
  const resizeOpts = opts.canvasResize || {};
  ensureStyles();

  const root = h('div', { class: CLS });

  // --- Segmented tier switch ---
  const seg = h('div', { class: `${CLS}-seg`, role: 'radiogroup', 'aria-label': t('label') });
  const thumb = h('div', { class: `${CLS}-thumb`, 'data-instant': '' });
  seg.appendChild(thumb);
  const tierBtns = {} as Record<Tier, HTMLButtonElement>;
  TIERS.forEach((tier) => {
    const btn = h(
      'button',
      { type: 'button', role: 'radio', class: `${CLS}-tier`, 'data-tier': tier, 'aria-checked': 'false' },
      `${uiIcon(tier)}<span class="${CLS}-tier-name">${tierName(tier)}</span><i class="${CLS}-dot ${pfx}four-color"></i>`,
    ) as HTMLButtonElement;
    btn.addEventListener('click', () => ctrl.setTier(tier));
    tierBtns[tier] = btn;
    seg.appendChild(btn);
  });
  // Arrow keys move between tiers (radio group behaviour).
  seg.addEventListener('keydown', (ev) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[ev.key];
    if (!step) return;
    ev.preventDefault();
    const next = TIERS[(TIERS.indexOf(ctrl.getTier()) + step + TIERS.length) % TIERS.length];
    ctrl.setTier(next);
    tierBtns[next].focus();
  });

  // --- Width chip ---
  const chip = h('div', { class: `${CLS}-chip`, title: t('widthTitle') });
  const input = h('input', {
    class: `${CLS}-width`,
    type: 'text',
    inputmode: 'numeric',
    spellcheck: 'false',
    'aria-label': t('widthLabel'),
  }) as HTMLInputElement;
  const presetsBtn = h(
    'button',
    { type: 'button', class: `${CLS}-icon-btn`, title: t('presets'), 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    uiIcon('chevron'),
  ) as HTMLButtonElement;
  chip.append(h('span', {}, uiIcon('width')).firstChild!, input, h('span', { class: `${CLS}-unit` }, 'px'), presetsBtn);

  const commitWidth = () => {
    const parsed = parseInt(input.value, 10);
    // setCustomWidth clamps to the allowed range.
    if (Number.isFinite(parsed) && parsed > 0) setCustomWidth(editor, parsed, resizeOpts);
    render();
  };
  input.addEventListener('change', commitWidth);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') input.blur();
    if (ev.key === 'Escape') {
      render();
      input.blur();
    }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      const step = (ev.shiftKey ? 10 : 1) * (ev.key === 'ArrowUp' ? 1 : -1);
      input.value = String((parseInt(input.value, 10) || 0) + step);
      commitWidth();
    }
  });
  input.addEventListener('focus', () => input.select());

  // --- Breakpoints button ---
  const bpBtn = h(
    'button',
    { type: 'button', class: `${CLS}-icon-btn ${CLS}-bp-btn`, title: t('breakpoints'), 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
    uiIcon('ruler'),
  ) as HTMLButtonElement;

  root.append(seg, chip, bpBtn);

  // --- Popovers ---
  const presetsPop = h('div', { class: `${CLS}-pop ${pfx}two-color`, role: 'menu', hidden: '' });
  const presetBtns = WIDTH_PRESETS.map(({ width, key }) => {
    const btn = h(
      'button',
      { type: 'button', role: 'menuitem', class: `${CLS}-preset`, 'data-width': String(width) },
      `<span class="${CLS}-preset-icon"></span><span class="${CLS}-preset-name">${t(`preset.${key}`)}</span><span class="${CLS}-preset-px">${width}px</span>`,
    ) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      setCustomWidth(editor, width, resizeOpts);
      closePopovers();
    });
    presetsPop.appendChild(btn);
    return btn;
  });

  const bpEditor = createBreakpointEditor(editor, ctrl);
  const bpPop = h('div', { class: `${CLS}-pop ${CLS}-pop-bp ${pfx}two-color`, role: 'dialog', 'aria-label': t('breakpoints'), hidden: '' });
  bpPop.appendChild(bpEditor.el);

  const popovers: [HTMLElement, HTMLButtonElement][] = [
    [presetsPop, presetsBtn],
    [bpPop, bpBtn],
  ];

  const closePopovers = () => {
    popovers.forEach(([pop, btn]) => {
      pop.hidden = true;
      pop.removeAttribute('data-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  };

  const togglePopover = (pop: HTMLElement, btn: HTMLButtonElement, anchor: HTMLElement) => {
    const open = pop.hidden;
    closePopovers();
    if (!open) return;
    if (!pop.isConnected) document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    pop.hidden = false;
    const width = pop.offsetWidth;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    Object.assign(pop.style, { top: `${rect.bottom + 6}px`, left: `${left}px` });
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => pop.setAttribute('data-open', ''));
    if (pop === bpPop) bpEditor.render();
    (pop.querySelector('[aria-current="true"]') as HTMLElement | null)?.focus();
  };

  presetsBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    togglePopover(presetsPop, presetsBtn, chip);
  });
  bpBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    togglePopover(bpPop, bpBtn, bpBtn);
  });
  const onDocDown = (ev: Event) => {
    const target = ev.target as Node;
    if (popovers.some(([pop, btn]) => pop.contains(target) || btn.contains(target))) return;
    closePopovers();
  };
  const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && closePopovers();
  document.addEventListener('mousedown', onDocDown);
  document.addEventListener('keydown', onKey);

  // --- Render ---
  const currentWidth = () => getCurrentCanvasWidth(editor);

  const moveThumb = (btn: HTMLElement) => {
    thumb.style.width = `${btn.offsetWidth}px`;
    thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
  };

  function render() {
    const bp = ctrl.getBreakpoints();
    const tier = ctrl.getTier();
    const width = currentWidth();
    const cmp: Component | undefined = editor.getSelected();
    const overrides = cmp ? getOverrides(cmp) : {};

    TIERS.forEach((btnTier) => {
      const btn = tierBtns[btnTier];
      const active = btnTier === tier;
      btn.setAttribute('aria-checked', String(active));
      btn.tabIndex = active ? 0 : -1;
      btn.classList.toggle(`${pfx}four-color`, active);
      btn.title = isOverrideTier(btnTier)
        ? t('tierOverride', { tier: tierName(btnTier), px: bp[btnTier] })
        : t('tierBase', { tier: tierName(btnTier), px: bp.tablet - 1 });
      toggleAttr(btn, 'data-overridden', isOverrideTier(btnTier) && !!overrides[btnTier]);
    });
    moveThumb(tierBtns[tier]);
    // Animate only after the first placement.
    requestAnimationFrame(() => thumb.removeAttribute('data-instant'));

    if (document.activeElement !== input) input.value = width ? String(Math.round(width)) : '';

    presetBtns.forEach((btn) => {
      const presetWidth = Number(btn.dataset.width);
      const presetTier = tierForWidth(presetWidth, bp);
      btn.setAttribute('aria-current', String(presetWidth === width));
      btn.querySelector(`.${CLS}-preset-icon`)!.innerHTML = uiIcon(presetTier);
      btn.title = tierName(presetTier);
    });
    if (!bpPop.hidden) bpEditor.render();
  }

  const events = `device:select device:update ${evResponsiveUpdate} component:toggled component:update:${RESPONSIVE_PROP} canvas:frame:load`;
  editor.on(events, render);
  const onResize = () => render();
  window.addEventListener('resize', onResize);

  render();

  return {
    el: root,
    render,
    destroy() {
      editor.off(events, render);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      presetsPop.remove();
      bpPop.remove();
      root.remove();
    },
  };
}

/** Mount the bar into the `devices-c` top bar panel. Idempotent. */
export function mountDeviceBar(editor: Editor, opts: RequiredPluginOptions): DeviceBar | null {
  const panel = editor.Panels.getPanel('devices-c') as any;
  const panelEl: HTMLElement | undefined = panel?.view?.el;
  if (!panelEl) return null;
  const existing = (panelEl as any).__mjDeviceBar as DeviceBar | undefined;
  if (existing) return existing;
  const bar = createDeviceBar(editor, opts);
  panelEl.appendChild(bar.el);
  (panelEl as any).__mjDeviceBar = bar;
  editor.on('destroy', () => bar.destroy());
  return bar;
}
