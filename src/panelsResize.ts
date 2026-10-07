import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { getLayout } from './ui/layout';
import { attachSplitter } from './ui/splitter';

export const VIEWS_WIDTH_KEY = 'mjml-views-width';
export const VIEWS_WIDTH_MIN = 200;

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

function storeViewsWidth(storageKey: string, width: number | null) {
  try {
    if (width === null) globalThis.localStorage?.removeItem(storageKey);
    else globalThis.localStorage?.setItem(storageKey, String(Math.round(width)));
  } catch {
    // storage unavailable — width stays in memory
  }
}

/**
 * Resizable right sidebar (Style Manager / Traits / Layers / Blocks).
 *
 * The handle lives on the editor element — not inside the scrolling
 * views container — and the width goes through the shared layout, so
 * the sidebar tabs, its body, the options bar and the canvas all move
 * together. Double-click restores core's 15%. Returns a cleanup function.
 */
export function mountViewsResize(editor: Editor, opts: { storageKey?: string } = {}): () => void {
  const layout = getLayout(editor);
  const { editorEl } = layout;
  if (editorEl.querySelector(':scope > .mjml-views-resize')) return () => {};
  const storageKey = opts.storageKey ?? VIEWS_WIDTH_KEY;

  const stored = readStoredViewsWidth(storageKey);
  if (stored) layout.setViewsWidth(stored);

  const handle = document.createElement('div');
  handle.className = 'mjml-views-resize';
  editorEl.appendChild(handle);

  let startW = 0;
  let current: number | null = stored;
  const detach = attachSplitter(
    handle,
    {
      onStart: () => {
        startW = layout.getViewsWidth();
      },
      // Right-anchored: dragging left (negative dx) grows the sidebar.
      onMove: (dx) => {
        const next = Math.max(VIEWS_WIDTH_MIN, startW - dx);
        current = layout.setViewsWidth(Math.max(VIEWS_WIDTH_MIN, Math.min(next, layout.maxViewsWidth())));
      },
      onEnd: () => storeViewsWidth(storageKey, current),
      onReset: () => {
        current = layout.setViewsWidth(null);
        storeViewsWidth(storageKey, null);
      },
    },
    { label: 'Resize sidebar' },
  );

  return () => {
    detach();
    handle.remove();
  };
}

export default function loadPanelsResize(editor: Editor, _opts: RequiredPluginOptions) {
  editor.onReady(() => {
    try {
      mountViewsResize(editor);
    } catch {
      // Panels unavailable (headless editor) — nothing to resize.
    }
  });
}
