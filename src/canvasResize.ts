import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { cmdDeviceCustom, cmdDeviceDesktop } from './commands';
import { attachSplitter } from './ui/splitter';
import { ensureUiStyles } from './ui/styles';

export const CANVAS_WIDTH_KEY = 'mjml-canvas-width';
/** Last selected device id, restored on load. */
export const CANVAS_DEVICE_KEY = 'mjml-canvas-device';
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

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // storage unavailable — value stays in memory
  }
}

/** Test seam: persisted custom canvas width. */
export function readStoredCanvasWidth(storageKey = CANVAS_WIDTH_KEY): number | null {
  const raw = readStorage(storageKey);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= CANVAS_WIDTH_MIN ? parsed : null;
}

export function storeCanvasWidth(width: number, storageKey = CANVAS_WIDTH_KEY) {
  writeStorage(storageKey, String(Math.round(width)));
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
 * Persists the width unless `persist: false` (live drag). Returns the
 * applied (clamped) width.
 */
export function setCustomWidth(
  editor: any,
  widthPx: number,
  opts: ResizableCanvasOptions & { persist?: boolean } = {},
): number {
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
  if (opts.persist !== false) storeCanvasWidth(width, storageKey);
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

function attachGripBehavior(grip: HTMLElement, editor: any, opts: ResizableCanvasOptions, side: 'left' | 'right') {
  if (grip.dataset.mjmlBound) return;
  grip.dataset.mjmlBound = '1';
  const wrapper = grip.parentElement;
  let label = wrapper?.querySelector(':scope > .mjml-frame-size') as HTMLElement | null;
  if (wrapper && !label) {
    label = document.createElement('div');
    label.className = 'mjml-frame-size';
    wrapper.appendChild(label);
  }

  // The frame is centered: one edge moves half the width change, so the
  // width changes by 2×dx to keep the edge under the cursor.
  const dir = side === 'left' ? -1 : 1;
  let startW = 0;
  let zoom = 1;
  let current = 0;
  attachSplitter(
    grip,
    {
      onStart: () => {
        zoom = currentZoom(editor);
        startW = getCurrentCanvasWidth(editor) ?? readStoredCanvasWidth(opts.storageKey) ?? 600;
        current = startW;
        label?.classList.add('is-on');
      },
      onMove: (dx) => {
        const max = opts.max ?? resolveMaxWidth(editor);
        current = setCustomWidth(editor, clampCanvasWidth(startW + (2 * dx * dir) / zoom, max), { ...opts, persist: false });
        if (label) label.textContent = `${current} px`;
      },
      onEnd: () => {
        label?.classList.remove('is-on');
        if (current) storeCanvasWidth(current, opts.storageKey);
      },
      onReset: () => editor.runCommand?.(cmdDeviceDesktop),
    },
    { label: 'Resize canvas width' },
  );
}

/**
 * Decorate the frame wrapper slots rendered by core `FrameWrapView`
 * (`data-frame-left/right`) with drag grips. Dragging shows a width
 * label on the frame; the device bar width chip shows it too. Idempotent.
 */
export function decorateFrameWrapper(editor: any, slots: Record<string, HTMLElement | null>, opts: ResizableCanvasOptions = {}) {
  ensureUiStyles();
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

/** Remember the selected device id (the device bar re-renders on `device:select`). */
export function trackDevice(editor: Editor) {
  editor.on('device:select', ((device: any) => {
    const id = device?.get?.('id') ?? device?.id;
    if (id && readStorage(CANVAS_DEVICE_KEY) !== id) writeStorage(CANVAS_DEVICE_KEY, String(id));
  }) as any);
}

/**
 * Restore the device the user last worked in (not always Custom). Best-effort.
 * `presets: false` restores only a Custom width — used when the responsive
 * `startTier` option decides which preset the editor opens on.
 */
export function restoreDevice(editor: Editor, opts: ResizableCanvasOptions = {}, { presets = true } = {}) {
  try {
    const lastDevice = readStorage(CANVAS_DEVICE_KEY);
    if (lastDevice === CUSTOM_DEVICE_ID) {
      const stored = readStoredCanvasWidth(opts.storageKey);
      if (stored) setCustomWidth(editor, stored, opts);
    } else if (presets && lastDevice && lastDevice !== editor.Devices.getSelected()?.get('id') && editor.Devices.get(lastDevice)) {
      editor.Devices.select(lastDevice);
    }
  } catch {
    // storage/devices unavailable
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
      trackDevice(editor);
    } catch {
      // Event bus unavailable — skip sync.
    }
    restoreDevice(editor, opts, { presets: !pluginOpts?.responsive?.startTier });
  });
}

// Re-exported so the devices command stays thin.
export { cmdDeviceCustom };
