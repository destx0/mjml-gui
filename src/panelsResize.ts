import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';

export const VIEWS_WIDTH_KEY = 'mjml-views-width';
export const VIEWS_WIDTH_MIN = 200;

export interface ResizableViewsOptions {
  min?: number;
  /** Max width as a fraction of the viewport (0-1). @default 0.6 */
  maxRatio?: number;
  storageKey?: string;
}

/** Test seam: persisted sidebar width. */
export function readStoredViewsWidth(storageKey = VIEWS_WIDTH_KEY): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= VIEWS_WIDTH_MIN ? parsed : null;
  } catch {
    return null;
  }
}

function storeViewsWidth(storageKey: string, width: number) {
  try {
    globalThis.localStorage?.setItem(storageKey, String(Math.round(width)));
  } catch {
    // storage unavailable — width stays in memory
  }
}

function currentWidthPx(el: HTMLElement): number {
  const inline = parseInt(el.style.width, 10);
  if (Number.isFinite(inline) && inline > 0) return inline;
  try {
    const rect = el.getBoundingClientRect().width;
    if (rect > 0) return rect;
  } catch {
    // detached element in jsdom — fall through
  }
  return 300;
}

/**
 * Make the right sidebar (Layers, Style Manager, Blocks — all views share
 * the `.gjs-pn-views-container`) resizable via a drag grip on its left
 * edge. Idempotent. Returns a cleanup function.
 */
export function makeResizableViews(el: HTMLElement, opts: ResizableViewsOptions = {}): () => void {
  if (el.querySelector(':scope > .mjml-views-resize')) return () => {};
  // The container is a Panel (z-index 3, same as the top bar). Widening it
  // would cover the top-bar icons with its transparent top zone, so keep it
  // just below the top bar but above the canvas (z-index 1).
  el.style.zIndex = '2';
  const min = opts.min ?? VIEWS_WIDTH_MIN;
  const maxRatio = opts.maxRatio ?? 0.6;
  const storageKey = opts.storageKey ?? VIEWS_WIDTH_KEY;
  const stored = readStoredViewsWidth(storageKey);
  let current: number = stored ?? currentWidthPx(el);
  if (stored) el.style.width = `${stored}px`;

  const grip = document.createElement('div');
  grip.className = 'mjml-views-resize';
  grip.style.cssText =
    'position:absolute;top:0;bottom:0;left:-4px;width:8px;cursor:ew-resize;z-index:5;background:rgba(255,255,255,0.06);';
  el.appendChild(grip);

  // Right-anchored: dragging left grows the sidebar.
  let dragStartX = 0;
  let dragStartW = 0;
  const onMove = (ev: MouseEvent) => {
    const max = Math.floor((globalThis.innerWidth || 1600) * maxRatio);
    current = Math.min(Math.max(dragStartW + (dragStartX - ev.clientX), min), max);
    el.style.width = `${Math.round(current)}px`;
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    storeViewsWidth(storageKey, current);
  };
  const onDown = (ev: MouseEvent) => {
    dragStartX = ev.clientX;
    dragStartW = current;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
    ev.preventDefault();
  };
  grip.addEventListener('mousedown', onDown);

  return () => {
    document.removeEventListener('mousemove', onMove);
    grip.removeEventListener('mousedown', onDown);
    grip.remove();
  };
}

/**
 * Find the views sidebar once the editor is ready and make it resizable.
 * Fully defensive — a missing sidebar is a no-op, never a crash.
 */
export default function loadPanelsResize(editor: Editor, _opts: RequiredPluginOptions) {
  editor.onReady(() => {
    try {
      const root = editor.getContainer() as unknown as HTMLElement | null;
      const scoped = root?.querySelector?.('.gjs-pn-views-container') as HTMLElement | null;
      const views = scoped ?? (document.querySelector('.gjs-pn-views-container') as HTMLElement | null);
      if (views) makeResizableViews(views);
    } catch {
      // Panels unavailable (headless editor) — nothing to resize.
    }
  });
}
