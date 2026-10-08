import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { cmdDeviceCustom } from './commands';

export const CANVAS_WIDTH_KEY = 'mjml-canvas-width';
export const CANVAS_WIDTH_MIN = 280;
export const CANVAS_WIDTH_MAX = 1200;
export const CUSTOM_DEVICE_ID = 'custom';
export const CUSTOM_DEVICE_NAME = 'Custom';

export interface ResizableCanvasOptions {
  min?: number;
  /** Fallback max px when the canvas element can't be measured. @default 1200 */
  max?: number;
  storageKey?: string;
}

/** Test seam: persisted custom canvas width. */
export function readStoredCanvasWidth(storageKey = CANVAS_WIDTH_KEY): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= CANVAS_WIDTH_MIN ? parsed : null;
  } catch {
    return null;
  }
}

export function storeCanvasWidth(width: number, storageKey = CANVAS_WIDTH_KEY) {
  try {
    globalThis.localStorage?.setItem(storageKey, String(Math.round(width)));
  } catch {
    // storage unavailable — width stays in memory
  }
}

/** Parse `600px` / `600` / 600 → 600. Null when unparseable (e.g. fluid ''). */
export function parseWidthPx(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function clampCanvasWidth(width: number, max: number): number {
  const lo = CANVAS_WIDTH_MIN;
  const hi = Math.max(lo, max || CANVAS_WIDTH_MAX);
  return Math.min(Math.max(Math.round(width), lo), hi);
}

/** Max px the frame may grow to: canvas container width, else fallback. */
export function resolveMaxWidth(editor: any, fallback = CANVAS_WIDTH_MAX): number {
  try {
    const el = editor?.Canvas?.getElement?.() as HTMLElement | undefined;
    const w = el?.clientWidth || el?.parentElement?.clientWidth || 0;
    if (w > CANVAS_WIDTH_MIN) return w;
  } catch {
    // headless — use fallback
  }
  try {
    const w = globalThis.innerWidth || 0;
    if (w > CANVAS_WIDTH_MIN) return Math.min(w, 1600);
  } catch {
    // ignore
  }
  return fallback;
}

function currentZoom(editor: any): number {
  try {
    const z = editor?.Canvas?.getZoomDecimal?.() ?? editor?.getZoomDecimal?.() ?? 1;
    return z > 0 ? z : 1;
  } catch {
    return 1;
  }
}

/**
 * Ensure the `Custom` device exists and select it at `widthPx`.
 * Persists the width. Returns the applied (clamped) width.
 */
export function setCustomWidth(editor: any, widthPx: number, opts: ResizableCanvasOptions = {}): number {
  const max = opts.max ?? resolveMaxWidth(editor);
  const width = clampCanvasWidth(widthPx, max);
  const storageKey = opts.storageKey ?? CANVAS_WIDTH_KEY;
  try {
    const Devices = editor?.Devices;
    let device = Devices?.get?.(CUSTOM_DEVICE_ID) ?? Devices?.get?.(CUSTOM_DEVICE_NAME);
    if (!device && Devices?.add) {
      device = Devices.add({ id: CUSTOM_DEVICE_ID, name: CUSTOM_DEVICE_NAME, width: `${width}px` });
    } else if (device?.set) {
      device.set({ width: `${width}px`, widthMedia: `${width}px` });
    }
    // Route through the normal device pipeline so Canvas.updateDevice,
    // tooling and `device:select` listeners all run.
    if (Devices?.select && device) Devices.select(device);
    else editor?.setDevice?.(CUSTOM_DEVICE_NAME);
  } catch {
    // headless editor without Devices — width still reported/persisted
  }
  storeCanvasWidth(width, storageKey);
  return width;
}

/** Current effective canvas width in px, if determinable. */
export function getCurrentCanvasWidth(editor: any): number | null {
  try {
    const device = editor?.getDeviceModel?.() ?? editor?.Devices?.getSelected?.();
    const parsed = parseWidthPx(device?.get?.('width'));
    if (parsed) return parsed;
  } catch {
    // fall through to frame measurement
  }
  try {
    const frameEl = editor?.Canvas?.getFrameEl?.() as HTMLElement | undefined;
    const w = frameEl?.getBoundingClientRect?.().width ?? frameEl?.offsetWidth ?? 0;
    if (w > 0) return Math.round(w);
  } catch {
    // ignore
  }
  return null;
}

// --- DOM: canvas grips (the width field lives in the device bar) ---

function ensureCanvasStyle() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-mjml-canvas-resize]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-mjml-canvas-resize', '');
  style.textContent = `
    .gjs-frame-wrapper__left.mjml-frame-grip,
    .gjs-frame-wrapper__right.mjml-frame-grip {
      position: absolute; top: 0; bottom: 0; width: 8px;
      cursor: ew-resize; z-index: 5;
      background: transparent;
      transition: background 0.15s;
    }
    .gjs-frame-wrapper__left.mjml-frame-grip { left: -4px; }
    .gjs-frame-wrapper__right.mjml-frame-grip { right: -4px; }
    .gjs-frame-wrapper:hover .mjml-frame-grip { background: rgba(255,255,255,0.10); }
    .gjs-frame-wrapper__left.mjml-frame-grip:hover,
    .gjs-frame-wrapper__right.mjml-frame-grip:hover { background: rgba(59,151,227,0.55); }
  `;
  document.head.appendChild(style);
}

function attachGripBehavior(grip: HTMLElement, editor: any, opts: ResizableCanvasOptions, side: 'left' | 'right') {
  if (grip.dataset.mjmlBound) return;
  grip.dataset.mjmlBound = '1';
  grip.addEventListener('mousedown', (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    const zoom = currentZoom(editor);
    const startX = ev.clientX;
    const startW = getCurrentCanvasWidth(editor) ?? readStoredCanvasWidth(opts.storageKey) ?? 600;
    const dir = side === 'left' ? -1 : 1;
    const onMove = (mv: MouseEvent) => {
      const max = opts.max ?? resolveMaxWidth(editor);
      // Screen-px delta corrected for canvas zoom → frame-px delta.
      const next = startW + ((mv.clientX - startX) * dir) / zoom;
      setCustomWidth(editor, clampCanvasWidth(next, max), opts);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  });
}

/**
 * Decorate the frame wrapper slots rendered by core `FrameWrapView`
 * (`data-frame-left/right`) with invisible-until-hover drag grips.
 * The width readout lives in the top bar control only — nothing is
 * added to the frame itself. Idempotent.
 */
export function decorateFrameWrapper(editor: any, slots: Record<string, HTMLElement | null>, opts: ResizableCanvasOptions = {}) {
  ensureCanvasStyle();
  const { elLeft, elRight } = slots;
  if (elLeft) {
    elLeft.classList.add('mjml-frame-grip');
    attachGripBehavior(elLeft, editor, opts, 'left');
  }
  if (elRight) {
    elRight.classList.add('mjml-frame-grip');
    attachGripBehavior(elRight, editor, opts, 'right');
  }
}

/** Remove readouts left behind by older versions (below the top bar). */
export function removeLegacyCanvasBadges() {
  if (typeof document === 'undefined') return;
  try {
    document.querySelectorAll('.mjml-canvas-width-badge').forEach((el) => el.remove());
  } catch {
    // DOM unavailable — skip
  }
}

/**
 * Wire everything once the editor is ready. Fully defensive — a missing
 * frame/panel is a no-op, never a crash (headless editor safe).
 */
export default function loadCanvasResize(editor: Editor, pluginOpts: RequiredPluginOptions) {
  const opts: ResizableCanvasOptions = { ...(pluginOpts?.canvasResize || {}) };
  editor.onReady(() => {
    removeLegacyCanvasBadges();
    const install = () => {
      try {
        // Future full re-renders (e.g. page switch) re-decorate via onRender.
        const frame: any = (editor as any)?.Canvas?.getFrame?.(0)
          ?? (editor as any)?.getCurrentFrameModel?.();
        if (frame?.set && !frame.get?.('onRender')) {
          frame.set('onRender', ({ elRight, elLeft }: any) =>
            decorateFrameWrapper(editor, { elRight, elLeft }, opts),
          );
        }
        // Decorate the already-rendered wrapper immediately.
        const root = (editor.getContainer() as unknown as HTMLElement | null) ?? document;
        const wrapper = root.querySelector?.('.gjs-frame-wrapper') as HTMLElement | null;
        if (wrapper) {
          decorateFrameWrapper(editor, {
            elRight: wrapper.querySelector('[data-frame-right]'),
            elLeft: wrapper.querySelector('[data-frame-left]'),
          }, opts);
        }
      } catch {
        // Canvas unavailable — nothing to resize.
      }
    };
    install();
    try {
      // Frame re-created after load → decorate again.
      editor.on('frame:load', install as any);
    } catch {
      // Event bus unavailable — skip sync.
    }
    try {
      // Restore persisted custom width (user chose persistence).
      const stored = readStoredCanvasWidth(opts.storageKey);
      if (stored) setCustomWidth(editor, stored, opts);
    } catch {
      // Restore is best-effort.
    }
  });
}

// Re-exported so the devices command stays thin.
export { cmdDeviceCustom };
