import type { Editor } from 'grapesjs';
import { ensureUiStyles } from './styles';

/** The canvas never gets narrower than this while panes are resized. */
export const CANVAS_MIN_WIDTH = 320;
/** Core's sidebar width when nothing was resized. */
export const VIEWS_DEFAULT_RATIO = 0.15;

export type DockSide = 'left' | 'right';

export interface EditorLayout {
  /** Editor container (where the CSS variables live). */
  root: HTMLElement;
  /** `.gjs-editor` element — mount point for dock + splitters. */
  editorEl: HTMLElement;
  /** Current sidebar width in px (resolved from the 15% default if unset). */
  getViewsWidth(): number;
  /** Set the sidebar width (clamped); `null` restores core's 15%. Returns the applied px or null. */
  setViewsWidth(px: number | null): number | null;
  maxViewsWidth(): number;
  /** Space taken by the code dock (0 when closed). */
  getDockWidth(): number;
  /** Report the dock size; `0` when closed. Returns the applied (clamped) px. */
  setDockWidth(side: DockSide, px: number): number;
  maxDockWidth(): number;
  /** Re-measure GrapesJS overlays (highlighter, toolbar, badges). Batched per frame. */
  refresh(): void;
  destroy(): void;
}

const layouts = new WeakMap<object, EditorLayout>();

function totalWidth(root: HTMLElement): number {
  const w = root.clientWidth || root.getBoundingClientRect?.().width || 0;
  return w > 0 ? w : (globalThis.innerWidth || 1600);
}

/**
 * One layout controller per editor. Pane sizes are written as CSS
 * variables on the container (see styles.ts), so the canvas, top bar and
 * sidebar always agree, and every change ends in `editor.refresh()` so
 * selection outlines follow the canvas.
 */
export function getLayout(editor: Editor): EditorLayout {
  const existing = layouts.get(editor);
  if (existing) return existing;

  ensureUiStyles();
  const elOf = (v: unknown) => (v && (v as HTMLElement).nodeType === 1 ? (v as HTMLElement) : null);
  const editorEl = elOf((editor as any).getEl?.()) ?? elOf(editor.getContainer?.()) ?? document.body;
  const root = elOf(editor.getContainer?.()) ?? editorEl;

  let viewsPx: number | null = null;
  let dockSide: DockSide = 'left';
  let dockPx = 0;
  let raf = 0;

  const resolvedViews = () => viewsPx ?? Math.round(totalWidth(root) * VIEWS_DEFAULT_RATIO);
  const room = (other: number) => Math.max(0, totalWidth(root) - other - CANVAS_MIN_WIDTH);

  const writeVars = () => {
    const { style } = root;
    if (viewsPx === null) style.removeProperty('--mjml-views-w');
    else style.setProperty('--mjml-views-w', `${viewsPx}px`);
    style.setProperty('--mjml-dock-l', `${dockSide === 'left' ? dockPx : 0}px`);
    style.setProperty('--mjml-dock-r', `${dockSide === 'right' ? dockPx : 0}px`);
  };

  const refresh = () => {
    if (raf) return;
    const run = () => {
      raf = 0;
      try {
        editor.refresh?.();
        editor.trigger?.('mjml:layout');
      } catch {
        // canvas not rendered (headless)
      }
    };
    if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(run) as unknown as number;
    else run();
  };

  const layout: EditorLayout = {
    root,
    editorEl,
    getViewsWidth: resolvedViews,
    maxViewsWidth: () => room(dockPx),
    setViewsWidth(px) {
      viewsPx = px === null ? null : Math.round(Math.max(0, Math.min(px, room(dockPx))));
      writeVars();
      refresh();
      return viewsPx;
    },
    getDockWidth: () => dockPx,
    maxDockWidth: () => room(resolvedViews()),
    setDockWidth(side, px) {
      dockSide = side;
      dockPx = px > 0 ? Math.round(Math.min(px, Math.max(room(resolvedViews()), 0))) : 0;
      writeVars();
      refresh();
      return dockPx;
    },
    refresh,
    destroy() {
      layouts.delete(editor);
      globalThis.removeEventListener?.('resize', onWinResize);
      ro?.disconnect();
      root.classList.remove('mjml-preview');
      ['--mjml-views-w', '--mjml-dock-l', '--mjml-dock-r'].forEach((v) => root.style.removeProperty(v));
    },
  };

  // Window shrank: give space back to the canvas (sidebar first, then dock).
  const onWinResize = () => {
    if (viewsPx !== null && viewsPx > room(dockPx)) viewsPx = Math.max(0, room(dockPx));
    if (dockPx > room(resolvedViews())) dockPx = Math.max(0, room(resolvedViews()));
    writeVars();
  };
  globalThis.addEventListener?.('resize', onWinResize);

  // Any canvas size change (pane resize, dock toggle, fullscreen) → re-measure overlays.
  let ro: ResizeObserver | null = null;
  try {
    const canvasEl = (editor as any).Canvas?.getElement?.() as HTMLElement | undefined;
    if (canvasEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => refresh());
      ro.observe(canvasEl);
    }
  } catch {
    // no canvas yet / no ResizeObserver — explicit refresh() calls still run
  }

  // Core preview hides the panels; hide our chrome too.
  try {
    editor.on('run:core:preview', () => root.classList.add('mjml-preview'));
    editor.on('stop:core:preview', () => root.classList.remove('mjml-preview'));
    editor.on('destroy', () => layout.destroy());
  } catch {
    // event bus unavailable
  }

  writeVars();
  layouts.set(editor, layout);
  return layout;
}
