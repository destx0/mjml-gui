/**
 * All editor-chrome CSS added by the plugin, in one stylesheet.
 *
 * Layout model: GrapesJS core positions its panels absolutely with fixed
 * percentages (canvas 85%, sidebar 15%). We keep that model — so the
 * editor still looks and behaves like stock GrapesJS — but drive every
 * coordinate from three CSS variables on the editor container:
 *
 *   --mjml-views-w   right sidebar width     (default 15%, like core)
 *   --mjml-dock-l    code dock on the left   (0px when closed)
 *   --mjml-dock-r    code dock on the right  (0px when closed)
 *
 * Canvas, top bar, sidebar tabs and sidebar body all read the same
 * variables, so they can never overlap or drift apart.
 */
export const UI_STYLE_ATTR = 'data-mjml-ui';

const VIEWS = 'var(--mjml-views-w, 15%)';
const DOCK_L = 'var(--mjml-dock-l, 0px)';
const DOCK_R = 'var(--mjml-dock-r, 0px)';
const ACCENT = 'var(--mjml-accent, #d278c9)';
const LINE = 'rgba(0,0,0,0.25)';
const SOFT = 'rgba(255,255,255,0.12)';

export const UI_CSS = `
/* ---------- layout (driven by CSS variables, see layout.ts) ---------- */
.gjs-editor-cont .gjs-cv-canvas {
  left: ${DOCK_L};
  width: calc(100% - ${DOCK_L} - ${DOCK_R} - ${VIEWS});
}
.gjs-editor-cont .gjs-pn-commands { width: calc(100% - ${VIEWS}); }
.gjs-editor-cont .gjs-pn-options { right: ${VIEWS}; }
.gjs-editor-cont .gjs-pn-views,
.gjs-editor-cont .gjs-pn-views-container { width: ${VIEWS}; }

/* ---------- splitter handles ---------- */
.mjml-splitter {
  position: absolute; top: 0; bottom: 0; width: 9px;
  cursor: ew-resize; touch-action: none; z-index: 6; outline: none;
}
.mjml-splitter::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 4px; width: 1px;
  background: transparent; transition: background .12s, left .12s, width .12s;
}
.mjml-splitter:hover::after,
.mjml-splitter:focus-visible::after,
.mjml-splitter.is-active::after { left: 3px; width: 3px; background: ${ACCENT}; }
.mjml-views-resize { top: 40px; right: ${VIEWS}; transform: translateX(50%); }

html.mjml-dragging iframe { pointer-events: none !important; }
html.mjml-dragging, html.mjml-dragging * { cursor: ew-resize !important; user-select: none !important; }
html.mjml-dragging .gjs-frame-wrapper--anim { transition: none !important; }

/* Core preview hides panels; hide our chrome with them. */
.mjml-preview .mjml-code-dock,
.mjml-preview .mjml-splitter,
.mjml-preview .mjml-frame-grip { display: none !important; }

/* ---------- top bar ---------- */
.gjs-pn-panel .gjs-pn-btn.mjml-sep { margin-left: 11px; }
.gjs-pn-panel .gjs-pn-btn.mjml-sep::before {
  content: ''; position: absolute; left: -8px; top: 7px; bottom: 7px; width: 1px;
  background: ${SOFT}; pointer-events: none;
}
.gjs-pn-panel .gjs-pn-btn.gjs-disabled { opacity: .3; cursor: default; pointer-events: none; }
.gjs-pn-panel.gjs-pn-devices-c { left: 44px; padding-left: 12px; }
.gjs-pn-panel.gjs-pn-devices-c::before {
  content: ''; position: absolute; left: 0; top: 12px; bottom: 12px; width: 1px; background: ${SOFT};
}

/* ---------- canvas frame grips ---------- */
.gjs-frame-wrapper__left.mjml-frame-grip,
.gjs-frame-wrapper__right.mjml-frame-grip { width: 9px; transform: translateY(-50%); }
.gjs-frame-wrapper__left.mjml-frame-grip { left: -9px; }
.gjs-frame-wrapper__right.mjml-frame-grip { right: -9px; }
.gjs-frame-wrapper__left.mjml-frame-grip::after { left: 5px; }
.gjs-frame-wrapper__right.mjml-frame-grip::after { left: 3px; }
.gjs-frame-wrapper:hover .mjml-frame-grip::after { background: ${SOFT}; }
.gjs-frame-wrapper .mjml-frame-grip:hover::after,
.gjs-frame-wrapper .mjml-frame-grip.is-active::after { background: ${ACCENT}; width: 3px; }
.mjml-frame-size {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  padding: 2px 8px; border-radius: 3px; background: rgba(0,0,0,.75); color: #fff;
  font: 11px/16px Helvetica, sans-serif; pointer-events: none; z-index: 5; display: none;
}
.mjml-frame-size.is-on { display: block; }

/* ---------- code dock ---------- */
.mjml-code-dock {
  position: absolute; top: 40px; bottom: 0; left: 0; z-index: 2;
  width: 480px; box-sizing: border-box; display: none; flex-direction: column;
  font-family: Helvetica, sans-serif; font-size: .75rem;
  border-right: 1px solid ${LINE}; box-shadow: 0 0 5px rgba(0,0,0,.2);
}
.mjml-code-dock.is-open { display: flex; }
.mjml-code-dock--right { left: auto; right: ${VIEWS}; border-right: 0; border-left: 1px solid ${LINE}; }
.mjml-code-dock > .mjml-code-dock-resize { right: -5px; }
.mjml-code-dock--right > .mjml-code-dock-resize { right: auto; left: -5px; }

.mjml-dock-bar {
  display: flex; align-items: center; gap: 2px; flex: none;
  height: 34px; padding: 0 6px; border-bottom: 1px solid ${LINE};
}
.mjml-dock-spacer { flex: 1; }
.mjml-dock-tab {
  height: 100%; padding: 0 10px; background: none; border: 0;
  border-bottom: 2px solid transparent; color: inherit; font: inherit;
  opacity: .6; cursor: pointer;
}
.mjml-dock-tab:hover { opacity: .9; }
.mjml-dock-tab.is-active { opacity: 1; border-bottom-color: ${ACCENT}; }
.mjml-dock-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 26px; padding: 0; border: 0; border-radius: 3px;
  background: none; color: inherit; opacity: .7; cursor: pointer;
}
.mjml-dock-icon:hover { opacity: 1; background: rgba(255,255,255,.08); }
.mjml-dock-icon.is-on { opacity: 1; color: ${ACCENT}; }
.mjml-dock-icon svg { width: 16px; height: 16px; fill: currentColor; }
.mjml-dock-icon[hidden], .mjml-dock-apply[hidden] { display: none; }
.mjml-dock-sep { width: 1px; height: 16px; margin: 0 4px; background: ${SOFT}; }
.mjml-dock-apply { margin: 0 4px; padding: 4px 12px; font: inherit; font-size: 12px; }
.mjml-dock-apply:disabled { opacity: .4; cursor: default; }

.mjml-dock-banner {
  display: none; flex: none; padding: 8px 12px; font-size: 12px;
  white-space: pre-wrap; max-height: 120px; overflow: auto;
}
.mjml-dock-banner.is-on { display: block; }
.mjml-dock-banner--error { background: rgba(221,54,54,.15); border-bottom: 1px solid #dd3636; }
.mjml-dock-banner--warn {
  display: none; align-items: center; gap: 8px; white-space: normal;
  background: rgba(255,170,0,.12); border-bottom: 1px solid rgba(255,170,0,.6);
}
.mjml-dock-banner--warn.is-on { display: flex; }
.mjml-dock-banner--warn span { flex: 1; }
.mjml-dock-banner--warn button { font: inherit; font-size: 11px; padding: 3px 8px; }

.mjml-dock-body { flex: 1; position: relative; min-height: 0; }
.mjml-dock-body > div, .mjml-dock-body > textarea { position: absolute; inset: 0; display: none; }
.mjml-dock-body > .is-on { display: block; }
.mjml-dock-body > textarea {
  width: 100%; height: 100%; box-sizing: border-box; padding: 8px; border: 0; resize: none;
  background: #1e1e1e; color: #d4d4d4; font-family: monospace; font-size: 12px;
}
.mjml-dock-status {
  flex: none; display: flex; gap: 8px; padding: 4px 10px; font-size: 11px;
  opacity: .75; border-top: 1px solid ${LINE};
}
.mjml-dock-status .is-dirty { color: ${ACCENT}; }
`;

/** Inject the plugin chrome stylesheet once per document. */
export function ensureUiStyles(doc: Document | undefined = typeof document !== 'undefined' ? document : undefined) {
  if (!doc?.head || doc.head.querySelector(`style[${UI_STYLE_ATTR}]`)) return;
  const style = doc.createElement('style');
  style.setAttribute(UI_STYLE_ATTR, '');
  style.textContent = UI_CSS;
  doc.head.appendChild(style);
}
