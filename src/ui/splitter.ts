import { ensureUiStyles } from './styles';

export interface SplitterHandlers {
  /** Drag started. Capture the start size here. */
  onStart?: () => void;
  /** Pointer moved `dx` screen px from where the drag started. */
  onMove: (dx: number) => void;
  /** Drag finished (pointerup / cancel / window blur). Persist here. */
  onEnd?: () => void;
  /** Double-click on the handle: back to the default size. */
  onReset?: () => void;
}

export interface SplitterOptions {
  /** Accessible name, also used as the tooltip. */
  label?: string;
  /** Arrow-key step in px (Shift = ×4). @default 16 */
  keyStep?: number;
}

/** Class on <html> while any splitter drags (iframes stop eating events). */
export const DRAGGING_CLASS = 'mjml-dragging';

/**
 * Turn `handle` into a horizontal drag handle.
 *
 * Why not plain mousemove on document: the canvas is an iframe, and a
 * cursor over it stops delivering mousemove/mouseup to the parent page —
 * the drag freezes, and releasing over the iframe leaves it "stuck".
 * Here the pointer is captured on the handle, and every iframe gets
 * `pointer-events:none` for the duration of the drag (see styles.ts).
 *
 * Returns a cleanup function.
 */
export function attachSplitter(handle: HTMLElement, handlers: SplitterHandlers, opts: SplitterOptions = {}): () => void {
  ensureUiStyles();
  const doc = handle.ownerDocument || document;
  const root = doc.documentElement;
  const keyStep = opts.keyStep ?? 16;

  handle.classList.add('mjml-splitter');
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.tabIndex = 0;
  if (opts.label) {
    handle.setAttribute('aria-label', opts.label);
    handle.title = `${opts.label} — drag to resize, double-click to reset`;
  }

  let startX = 0;
  let pointerId: number | null = null;
  let dragging = false;

  const onMove = (ev: MouseEvent) => {
    if (!dragging) return;
    handlers.onMove(ev.clientX - startX);
  };

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener('pointermove', onMove as any);
    doc.removeEventListener('pointerup', finish);
    doc.removeEventListener('pointercancel', finish);
    doc.defaultView?.removeEventListener('blur', finish);
    try {
      pointerId !== null && handle.releasePointerCapture?.(pointerId);
    } catch {
      // capture already released by the browser
    }
    pointerId = null;
    handle.classList.remove('is-active');
    root.classList.remove(DRAGGING_CLASS);
    handlers.onEnd?.();
  };

  const onDown = (ev: MouseEvent) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    startX = ev.clientX;
    dragging = true;
    pointerId = (ev as PointerEvent).pointerId ?? null;
    try {
      pointerId !== null && handle.setPointerCapture?.(pointerId);
    } catch {
      // synthetic event (tests) — document listeners still work
    }
    handle.classList.add('is-active');
    root.classList.add(DRAGGING_CLASS);
    handlers.onStart?.();
    doc.addEventListener('pointermove', onMove as any);
    doc.addEventListener('pointerup', finish);
    doc.addEventListener('pointercancel', finish);
    doc.defaultView?.addEventListener('blur', finish);
  };

  const onDblClick = (ev: MouseEvent) => {
    ev.preventDefault();
    handlers.onReset?.();
  };

  const onKey = (ev: KeyboardEvent) => {
    const dir = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
    if (!dir) return;
    ev.preventDefault();
    handlers.onStart?.();
    handlers.onMove(dir * keyStep * (ev.shiftKey ? 4 : 1));
    handlers.onEnd?.();
  };

  handle.addEventListener('pointerdown', onDown as any);
  handle.addEventListener('dblclick', onDblClick);
  handle.addEventListener('keydown', onKey);

  return () => {
    finish();
    handle.removeEventListener('pointerdown', onDown as any);
    handle.removeEventListener('dblclick', onDblClick);
    handle.removeEventListener('keydown', onKey);
  };
}
