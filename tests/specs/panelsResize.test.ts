import type { Editor } from 'grapesjs';
import { mountViewsResize, readStoredViewsWidth, VIEWS_WIDTH_KEY, VIEWS_WIDTH_MIN } from '../../src/panelsResize';
import { CANVAS_MIN_WIDTH, getLayout } from '../../src/ui/layout';
import { attachSplitter, DRAGGING_CLASS } from '../../src/ui/splitter';
import { UI_CSS } from '../../src/ui/styles';

const pointer = (type: string, clientX: number, target: EventTarget = document) =>
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, button: 0 }));

describe('attachSplitter', () => {
  let handle: HTMLElement;

  beforeEach(() => {
    handle = document.createElement('div');
    document.body.appendChild(handle);
  });

  afterEach(() => handle.remove());

  test('reports dx from the drag start and ends on pointerup', () => {
    const moves: number[] = [];
    const onEnd = jest.fn();
    attachSplitter(handle, { onMove: (dx) => moves.push(dx), onEnd });
    pointer('pointerdown', 100, handle);
    pointer('pointermove', 130);
    pointer('pointermove', 90);
    pointer('pointerup', 90);
    pointer('pointermove', 400); // after release: ignored
    expect(moves).toEqual([30, -10]);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('marks <html> while dragging so iframes stop swallowing the pointer', () => {
    attachSplitter(handle, { onMove: () => {} });
    pointer('pointerdown', 0, handle);
    expect(document.documentElement.classList.contains(DRAGGING_CLASS)).toBe(true);
    expect(UI_CSS).toContain(`html.${DRAGGING_CLASS} iframe { pointer-events: none !important; }`);
    pointer('pointercancel', 0);
    expect(document.documentElement.classList.contains(DRAGGING_CLASS)).toBe(false);
  });

  test('window blur ends a drag (released outside the window)', () => {
    const onEnd = jest.fn();
    attachSplitter(handle, { onMove: () => {}, onEnd });
    pointer('pointerdown', 0, handle);
    window.dispatchEvent(new Event('blur'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('double-click resets, arrow keys nudge', () => {
    const onReset = jest.fn();
    const moves: number[] = [];
    attachSplitter(handle, { onMove: (dx) => moves.push(dx), onReset });
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(moves).toEqual([-16, 64]);
    expect(handle.getAttribute('role')).toBe('separator');
  });
});

/** Minimal editor stand-in: jsdom can't render the full editor UI. */
function stubEditor(width = 1400) {
  const root = document.createElement('div');
  root.className = 'gjs-editor-cont';
  const editorEl = document.createElement('div');
  editorEl.className = 'gjs-editor';
  root.appendChild(editorEl);
  document.body.appendChild(root);
  Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => width });
  const handlers: Record<string, Function[]> = {};
  const editor: any = {
    getContainer: () => root,
    getEl: () => editorEl,
    refresh: jest.fn(),
    trigger: (ev: string) => (handlers[ev] || []).forEach((h) => h()),
    on: (evs: string, h: Function) => evs.split(' ').forEach((ev) => (handlers[ev] = [...(handlers[ev] || []), h])),
    runCommand: (id: string) => editor.trigger(`run:${id}`),
    stopCommand: (id: string) => editor.trigger(`stop:${id}`),
    destroy: () => {
      editor.trigger('destroy');
      root.remove();
    },
  };
  return { editor: editor as Editor, root, editorEl };
}

describe('editor layout + sidebar resize', () => {
  let editor: Editor;
  let root: HTMLElement;
  let editorEl: HTMLElement;

  beforeEach(() => {
    global.localStorage.removeItem(VIEWS_WIDTH_KEY);
    ({ editor, root, editorEl } = stubEditor());
    mountViewsResize(editor);
  });

  afterEach(() => {
    editor.destroy();
    global.localStorage.removeItem(VIEWS_WIDTH_KEY);
  });

  const handle = () => editorEl.querySelector(':scope > .mjml-views-resize') as HTMLElement;

  function drag(fromX: number, toX: number) {
    pointer('pointerdown', fromX, handle());
    pointer('pointermove', toX);
    pointer('pointerup', toX);
  }

  test('canvas, top bar and sidebar all read the same width variables', () => {
    expect(UI_CSS).toMatch(/\.gjs-cv-canvas \{[^}]*width: calc\(100% - var\(--mjml-dock-l, 0px\) - var\(--mjml-dock-r, 0px\) - var\(--mjml-views-w, 15%\)\)/);
    expect(UI_CSS).toMatch(/\.gjs-pn-options \{ right: var\(--mjml-views-w, 15%\); \}/);
    expect(UI_CSS).toMatch(/\.gjs-pn-views,\s*\.gjs-editor-cont \.gjs-pn-views-container \{ width: var\(--mjml-views-w, 15%\); \}/);
  });

  test('mounts one handle on the editor element (not inside the scrolling sidebar)', () => {
    mountViewsResize(editor);
    expect(editorEl.querySelectorAll(':scope > .mjml-views-resize')).toHaveLength(1);
  });

  test('dragging left grows the sidebar, persists and re-measures the canvas', async () => {
    // 15% of 1400 = 210 → +100
    drag(500, 400);
    expect(getLayout(editor).getViewsWidth()).toBe(310);
    expect(global.localStorage.getItem(VIEWS_WIDTH_KEY)).toBe('310');
    await new Promise((r) => setTimeout(r, 50)); // refresh is batched per animation frame
    expect(editor.refresh).toHaveBeenCalled();
  });

  test('clamped to the minimum and to what leaves the canvas its minimum', () => {
    drag(500, 1400);
    expect(getLayout(editor).getViewsWidth()).toBe(VIEWS_WIDTH_MIN);
    drag(500, -2000);
    expect(getLayout(editor).getViewsWidth()).toBe(1400 - CANVAS_MIN_WIDTH);
  });

  test('double-click restores the core 15% default', () => {
    drag(500, 400);
    handle().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(getLayout(editor).getViewsWidth()).toBe(210); // 15% of 1400
    expect(global.localStorage.getItem(VIEWS_WIDTH_KEY)).toBeFalsy();
  });

  test('sidebar and dock together never squeeze the canvas below its minimum', () => {
    const layout = getLayout(editor);
    layout.setViewsWidth(500);
    expect(layout.setDockWidth('left', 900)).toBe(1400 - 500 - CANVAS_MIN_WIDTH);
    expect(layout.getDockWidth()).toBe(580);
    expect(layout.maxViewsWidth()).toBe(1400 - 580 - CANVAS_MIN_WIDTH);
    layout.setDockWidth('left', 0);
    expect(layout.getDockWidth()).toBe(0);
  });

  test('right-side dock writes its own CSS variable', () => {
    const vars: Record<string, string> = {};
    jest.spyOn(root.style, 'setProperty').mockImplementation((k: string, v: any) => void (vars[k] = v));
    getLayout(editor).setDockWidth('right', 400);
    expect(vars).toMatchObject({ '--mjml-dock-r': '400px', '--mjml-dock-l': '0px' });
  });

  test('preview mode flags the container so the dock and handles hide', () => {
    editor.runCommand('core:preview');
    expect(root.classList.contains('mjml-preview')).toBe(true);
    editor.stopCommand('core:preview');
    expect(root.classList.contains('mjml-preview')).toBe(false);
  });

  test('restores the persisted width', () => {
    editor.destroy();
    global.localStorage.setItem(VIEWS_WIDTH_KEY, '360');
    ({ editor, root, editorEl } = stubEditor());
    mountViewsResize(editor);
    expect(getLayout(editor).getViewsWidth()).toBe(360);
  });

  test('readStoredViewsWidth ignores missing and invalid values', () => {
    expect(readStoredViewsWidth()).toBeNull();
    global.localStorage.setItem(VIEWS_WIDTH_KEY, 'junk');
    expect(readStoredViewsWidth()).toBeNull();
  });
});
