import type { Component, Editor } from 'grapesjs';
import { icon } from '../icons';
import {
  BREAKPOINT_MAX,
  BREAKPOINT_MIN,
  Breakpoints,
  OVERRIDE_TIERS,
  OverrideTier,
  TIERS,
  Tier,
  isOverrideTier,
  sameBreakpoints,
} from './breakpoints';
import { supportsResponsive } from './targets';
import type { ResponsiveController } from '.';
import { RESPONSIVE_PROP, evResponsiveUpdate, getOverrides } from './props';

const CLS = 'mjr';

const escapeHtml = (str: string) =>
  str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const STYLES = `
.${CLS} {
  padding: 8px 10px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
  font-size: 11px;
  text-align: left;
  user-select: none;
}
.${CLS}-head { display: flex; align-items: stretch; gap: 6px; }
.${CLS}-tiers {
  flex: 1; display: flex; padding: 2px; gap: 2px;
  background: rgba(0, 0, 0, 0.2); border-radius: 4px;
}
.${CLS}-tier {
  position: relative; flex: 1 1 0; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 5px 2px 4px; border: 0; border-radius: 3px;
  background: transparent; font: inherit; cursor: pointer;
  opacity: 0.6; transition: background 0.15s, opacity 0.15s;
}
.${CLS}-tier:not(.${CLS}-accent) { color: inherit; }
.${CLS}-tier:hover { opacity: 0.9; background: rgba(255, 255, 255, 0.05); }
.${CLS}-tier[aria-pressed="true"] { opacity: 1; background: rgba(255, 255, 255, 0.12); }
.${CLS}-tier svg { width: 16px; height: 16px; }
.${CLS}-tier-name { font-weight: 600; letter-spacing: 0.02em; }
.${CLS}-tier-range { font-size: 9.5px; opacity: 0.65; font-variant-numeric: tabular-nums; white-space: nowrap; }
.${CLS}-tier[aria-pressed="true"] .${CLS}-tier-range { opacity: 0.9; }
.${CLS}-dot {
  position: absolute; top: 5px; right: 6px; width: 5px; height: 5px;
  border-radius: 50%; background: currentColor; display: none;
}
.${CLS}-tier[data-overridden] .${CLS}-dot { display: block; }
.${CLS}-gear {
  display: flex; align-items: center; justify-content: center; width: 28px;
  border: 0; border-radius: 4px; background: rgba(0, 0, 0, 0.2);
  color: inherit; cursor: pointer; opacity: 0.6; transition: opacity 0.15s, background 0.15s;
}
.${CLS}-gear:hover { opacity: 1; }
.${CLS}-gear[aria-expanded="true"] { opacity: 1; background: rgba(255, 255, 255, 0.12); }
.${CLS}-gear svg { width: 18px; height: 18px; }
.${CLS}-hint { display: flex; align-items: baseline; gap: 7px; margin-top: 8px; line-height: 1.45; opacity: 0.8; }
.${CLS}-hint::before {
  content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%;
  background: currentColor; opacity: 0.5; transform: translateY(-1px);
}
.${CLS}[data-tier="tablet"] .${CLS}-hint::before,
.${CLS}[data-tier="desktop"] .${CLS}-hint::before { opacity: 1; }
.${CLS}-hint b { font-weight: 600; }
.${CLS}-hint[data-warn] { opacity: 1; }

.${CLS}-bp { margin-top: 10px; padding: 10px; border-radius: 4px; background: rgba(0, 0, 0, 0.2); }
.${CLS}-bp[hidden] { display: none; }
.${CLS}-bp-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26px; }
.${CLS}-bp-title span { font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; opacity: 0.7; }
.${CLS}-reset {
  border: 0; padding: 0; background: none; color: inherit; font: inherit;
  cursor: pointer; opacity: 0.7; text-decoration: underline; text-underline-offset: 2px;
}
.${CLS}-reset:hover { opacity: 1; }
.${CLS}-reset[hidden] { display: none; }
.${CLS}-ruler { position: relative; height: 22px; margin: 0 7px; touch-action: none; }
.${CLS}-zone {
  position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center;
  overflow: hidden; font-size: 9.5px; white-space: nowrap; transition: background 0.15s;
}
.${CLS}-zone[data-tier="mobile"] { background: rgba(255, 255, 255, 0.05); border-radius: 3px 0 0 3px; }
.${CLS}-zone[data-tier="tablet"] { background: rgba(255, 255, 255, 0.1); }
.${CLS}-zone[data-tier="desktop"] { background: rgba(255, 255, 255, 0.16); border-radius: 0 3px 3px 0; }
.${CLS}-zone span { opacity: 0.75; }
.${CLS}-zone[data-active] { box-shadow: inset 0 -2px 0 currentColor; }
.${CLS}-handle {
  position: absolute; top: -4px; bottom: -4px; width: 14px; margin-left: -7px;
  display: flex; justify-content: center; cursor: ew-resize; outline: none;
}
.${CLS}-handle::before {
  content: ''; width: 3px; border-radius: 2px; background: currentColor;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35); transition: width 0.1s;
}
.${CLS}-handle:hover::before, .${CLS}-handle:focus-visible::before, .${CLS}-handle[data-dragging]::before { width: 5px; }
.${CLS}-handle-label {
  position: absolute; bottom: calc(100% + 3px); padding: 1px 5px; border-radius: 3px;
  background: rgba(0, 0, 0, 0.45); font-size: 9.5px; font-variant-numeric: tabular-nums; white-space: nowrap;
  pointer-events: none;
}
.${CLS}-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
.${CLS}-field label { display: block; margin-bottom: 4px; opacity: 0.7; }
.${CLS}-input {
  display: flex; align-items: center; border-radius: 3px; background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 0, 0, 0.15);
}
.${CLS}-input:focus-within { border-color: rgba(255, 255, 255, 0.25); }
.${CLS}-input input {
  flex: 1; min-width: 0; padding: 5px 0 5px 7px; border: 0; outline: 0; background: none;
  color: inherit; font: inherit; font-size: 12px; font-variant-numeric: tabular-nums; -moz-appearance: textfield;
}
.${CLS}-input input::-webkit-inner-spin-button, .${CLS}-input input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.${CLS}-input span { padding: 0 7px; opacity: 0.5; font-size: 10px; }
.${CLS}-bp-note { margin-top: 10px; line-height: 1.45; opacity: 0.6; }
`;

const ensureStyles = () => {
  if (document.querySelector(`style[data-${CLS}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(`data-${CLS}`, '');
  style.textContent = STYLES;
  document.head.appendChild(style);
};

const TIER_ICONS: Record<Tier, 'mobile' | 'tablet' | 'desktop'> = {
  mobile: 'mobile',
  tablet: 'tablet',
  desktop: 'desktop',
};

/** Ruler scale (px) — always leaves room to the right of the desktop handle. */
const rulerMax = (bp: Breakpoints) => Math.max(1280, Math.ceil((bp.desktop + 320) / 160) * 160);

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = '') => {
  const node = document.createElement(tag);
  Object.keys(attrs).forEach((name) => node.setAttribute(name, attrs[name]));
  if (html) node.innerHTML = html;
  return node;
};

/**
 * Tier switch + breakpoint editor on top of the Style Manager.
 * Native GrapesJS look: dark translucent layers, theme accent color for
 * the active state, the Style Manager's own colors for inherited values.
 */
export default function mountResponsiveUi(editor: Editor, ctrl: ResponsiveController) {
  const pfx = editor.getConfig().stylePrefix || 'gjs-';
  const t = (key: string, params?: Record<string, any>) =>
    editor.I18n.t(`grapesjs-mjml.responsive.${key}`, { params });
  /** Translation with HTML-escaped params, for `innerHTML`. */
  const tHtml = (key: string, params: Record<string, any>) =>
    t(key, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, escapeHtml(String(v))])));
  const tierName = (tier: Tier) => t(`tiers.${tier}`);

  // --- Build ---------------------------------------------------------------

  const root = el('div', { class: CLS });
  const head = el('div', { class: `${CLS}-head` });
  const tiers = el('div', { class: `${CLS}-tiers`, role: 'group', 'aria-label': t('switchLabel') });
  const tierBtns = {} as Record<Tier, HTMLButtonElement>;

  TIERS.forEach((tier) => {
    const btn = el(
      'button',
      { type: 'button', class: `${CLS}-tier`, 'data-tier': tier },
      `${icon(TIER_ICONS[tier], '')}
       <span class="${CLS}-tier-name">${tierName(tier)}</span>
       <span class="${CLS}-tier-range"></span>
       <i class="${CLS}-dot ${pfx}four-color"></i>`,
    ) as HTMLButtonElement;
    btn.addEventListener('click', () => ctrl.setTier(tier));
    tierBtns[tier] = btn;
    tiers.appendChild(btn);
  });

  const gear = el(
    'button',
    { type: 'button', class: `${CLS}-gear`, title: t('breakpoints'), 'aria-expanded': 'false' },
    icon('ruler', ''),
  ) as HTMLButtonElement;
  head.append(tiers, gear);

  const hint = el('div', { class: `${CLS}-hint` });

  // Breakpoint editor
  const bpPanel = el('div', { class: `${CLS}-bp`, hidden: '' });
  const bpTitle = el('div', { class: `${CLS}-bp-title` }, `<span>${t('breakpoints')}</span>`);
  const resetBtn = el('button', { type: 'button', class: `${CLS}-reset` }, t('reset')) as HTMLButtonElement;
  bpTitle.appendChild(resetBtn);

  const ruler = el('div', { class: `${CLS}-ruler` });
  const zones = {} as Record<Tier, HTMLElement>;
  TIERS.forEach((tier) => {
    zones[tier] = el('div', { class: `${CLS}-zone`, 'data-tier': tier }, `<span>${tierName(tier)}</span>`);
    zones[tier].addEventListener('click', () => ctrl.setTier(tier));
    ruler.appendChild(zones[tier]);
  });
  const handles = {} as Record<OverrideTier, HTMLElement>;
  OVERRIDE_TIERS.forEach((tier) => {
    handles[tier] = el(
      'div',
      { class: `${CLS}-handle ${pfx}four-color`, role: 'slider', tabindex: '0', 'aria-label': t(`from.${tier}`) },
      `<span class="${CLS}-handle-label"></span>`,
    );
    ruler.appendChild(handles[tier]);
  });

  const fields = el('div', { class: `${CLS}-fields` });
  const inputs = {} as Record<OverrideTier, HTMLInputElement>;
  OVERRIDE_TIERS.forEach((tier) => {
    const field = el(
      'div',
      { class: `${CLS}-field` },
      `<label for="${CLS}-bp-${tier}">${t(`from.${tier}`)}</label>
       <div class="${CLS}-input"><input id="${CLS}-bp-${tier}" type="number" inputmode="numeric"
         min="${BREAKPOINT_MIN}" max="${BREAKPOINT_MAX}" step="1"/><span>px</span></div>`,
    );
    inputs[tier] = field.querySelector('input')!;
    fields.appendChild(field);
  });

  const note = el('div', { class: `${CLS}-bp-note` }, t('note'));
  bpPanel.append(bpTitle, ruler, fields, note);
  root.append(head, hint, bpPanel);

  // --- State ---------------------------------------------------------------

  /** Breakpoints being dragged (not committed yet). */
  let draft: Breakpoints | null = null;
  const currentBp = () => draft || ctrl.getBreakpoints();

  const selected = (): Component | undefined => editor.getSelected();

  const renderRuler = () => {
    const bp = currentBp();
    const max = rulerMax(bp);
    const pct = (px: number) => `${(px / max) * 100}%`;
    const tier = ctrl.getTier();
    const bounds: Record<Tier, [number, number]> = {
      mobile: [0, bp.tablet],
      tablet: [bp.tablet, bp.desktop],
      desktop: [bp.desktop, max],
    };
    TIERS.forEach((zoneTier) => {
      const [from, to] = bounds[zoneTier];
      const zone = zones[zoneTier];
      Object.assign(zone.style, { left: pct(from), width: pct(to - from) });
      zone.toggleAttribute('data-active', zoneTier === tier);
      zone.classList.toggle(`${pfx}four-color`, zoneTier === tier);
    });
    OVERRIDE_TIERS.forEach((bpTier) => {
      const value = String(bp[bpTier]);
      handles[bpTier].style.left = pct(bp[bpTier]);
      handles[bpTier].setAttribute('aria-valuenow', value);
      handles[bpTier].querySelector('span')!.textContent = value;
      if (document.activeElement !== inputs[bpTier]) inputs[bpTier].value = value;
    });
    resetBtn.hidden = sameBreakpoints(bp, ctrl.defaultBreakpoints());
  };

  const render = () => {
    const tier = ctrl.getTier();
    const bp = currentBp();
    const cmp = selected();
    const overrides = cmp ? getOverrides(cmp) : {};

    root.setAttribute('data-tier', tier);
    TIERS.forEach((btnTier) => {
      const btn = tierBtns[btnTier];
      const active = btnTier === tier;
      const range = btn.querySelector(`.${CLS}-tier-range`)!;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle(`${pfx}four-color`, active);
      btn.classList.toggle(`${CLS}-accent`, active);
      if (isOverrideTier(btnTier)) {
        btn.toggleAttribute('data-overridden', !!overrides[btnTier]);
        btn.title = t('tooltip.override', { tier: tierName(btnTier), px: bp[btnTier] });
        range.textContent = `≥ ${bp[btnTier]}px`;
      } else {
        btn.title = t('tooltip.base');
        range.textContent = t('range.base');
      }
    });

    // Hint line under the switch
    hint.removeAttribute('data-warn');
    hint.classList.remove(`${pfx}color-warn`);
    if (!isOverrideTier(tier)) {
      hint.innerHTML = `<span>${t('hint.base')}</span>`;
    } else if (cmp && !supportsResponsive(cmp.get('type')!)) {
      hint.innerHTML = `<span>${tHtml('hint.unsupported', { name: cmp.getName() })}</span>`;
      hint.setAttribute('data-warn', '');
      hint.classList.add(`${pfx}color-warn`);
    } else {
      hint.innerHTML = `<span>${tHtml('hint.override', { tier: tierName(tier), px: bp[tier] })}</span>`;
    }
    hint.classList.toggle(`${pfx}four-color`, isOverrideTier(tier) && !hint.hasAttribute('data-warn'));

    renderRuler();
  };

  // --- Breakpoint editing -------------------------------------------------

  const commit = (next: Partial<Breakpoints>) => {
    draft = null;
    ctrl.setBreakpoints(next);
    render();
  };

  gear.addEventListener('click', () => {
    const open = bpPanel.hidden;
    bpPanel.hidden = !open;
    gear.setAttribute('aria-expanded', String(open));
  });
  resetBtn.addEventListener('click', () => {
    draft = null;
    ctrl.resetBreakpoints();
    render();
  });

  OVERRIDE_TIERS.forEach((tier) => {
    const input = inputs[tier];
    input.addEventListener('change', () => commit({ [tier]: Number(input.value) }));
    input.addEventListener('keydown', (ev) => ev.key === 'Enter' && input.blur());

    const handle = handles[tier];
    handle.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      handle.setPointerCapture?.(ev.pointerId);
      handle.setAttribute('data-dragging', '');
      const start = ctrl.getBreakpoints();
      const scale = rulerMax(start);
      const rect = ruler.getBoundingClientRect();

      const onMove = (mv: PointerEvent) => {
        const raw = ((mv.clientX - rect.left) / rect.width) * scale;
        // Snap to 10px; hold Shift for single pixels.
        const px = mv.shiftKey ? Math.round(raw) : Math.round(raw / 10) * 10;
        // Stop at the other handle instead of pushing it.
        const [min, max] =
          tier === 'tablet' ? [BREAKPOINT_MIN, start.desktop - 1] : [start.tablet + 1, BREAKPOINT_MAX];
        draft = { ...start, [tier]: Math.min(Math.max(px, min), max) };
        renderRuler();
      };
      const onUp = () => {
        handle.removeAttribute('data-dragging');
        handle.removeEventListener('pointermove', onMove);
        draft ? commit(draft) : render();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp, { once: true });
      handle.addEventListener('pointercancel', onUp, { once: true });
    });

    handle.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[ev.key];
      if (!delta) return;
      ev.preventDefault();
      commit({ [tier]: ctrl.getBreakpoints()[tier] + delta });
    });
  });

  // --- Mount & sync --------------------------------------------------------

  const mount = () => {
    if (root.isConnected) return;
    const container = editor.getContainer() as HTMLElement | null;
    // Core's Style Manager panel: <div>[selectors + sectors] [empty-state header]</div>.
    // Mount in that outer div so the bar stays visible with nothing selected.
    const host = container?.querySelector(`.${pfx}sm-header`)?.parentElement;
    if (!host) return;
    ensureStyles();
    host.insertBefore(root, host.firstChild);
    render();
  };

  editor.on('run:open-sm run:core:open-styles', mount);
  mount();

  editor.on(`device:select ${evResponsiveUpdate} component:toggled component:update:${RESPONSIVE_PROP}`, () => {
    root.isConnected && render();
  });

  return root;
}
