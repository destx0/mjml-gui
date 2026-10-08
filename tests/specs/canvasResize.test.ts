import grapesjs, { Editor } from 'grapesjs';
import grapesJSMJML from '../../src';
import { cmdDeviceCustom } from '../../src/commands';
import { cmdDeviceDesktop, cmdDeviceTablet, cmdImportMjml } from '../../src/commands';
import { cmdExportMenu } from '../../src/commands/exportMenu';
import {
  CANVAS_DEVICE_KEY,
  CANVAS_WIDTH_KEY,
  CANVAS_WIDTH_MIN,
  clampCanvasWidth,
  decorateFrameWrapper,
  getCurrentCanvasWidth,
  parseWidthPx,
  readStoredCanvasWidth,
  removeLegacyCanvasBadges,
  restoreDevice,
  trackDevice,
  setCustomWidth,
} from '../../src/canvasResize';

describe('canvasResize helpers', () => {
  beforeEach(() => {
    global.localStorage.removeItem(CANVAS_WIDTH_KEY);
  });

  afterEach(() => {
    global.localStorage.removeItem(CANVAS_WIDTH_KEY);
  });

  test('clampCanvasWidth respects min and max', () => {
    expect(clampCanvasWidth(100, 1200)).toBe(CANVAS_WIDTH_MIN);
    expect(clampCanvasWidth(2000, 1200)).toBe(1200);
    expect(clampCanvasWidth(520, 1200)).toBe(520);
  });

  test('parseWidthPx handles px strings, numbers and fluid empty', () => {
    expect(parseWidthPx('600px')).toBe(600);
    expect(parseWidthPx('320')).toBe(320);
    expect(parseWidthPx(480)).toBe(480);
    expect(parseWidthPx('')).toBeNull();
    expect(parseWidthPx(null)).toBeNull();
  });

  test('readStoredCanvasWidth ignores missing and invalid values', () => {
    expect(readStoredCanvasWidth()).toBeNull();
    global.localStorage.setItem(CANVAS_WIDTH_KEY, 'junk');
    expect(readStoredCanvasWidth()).toBeNull();
    global.localStorage.setItem(CANVAS_WIDTH_KEY, '100');
    expect(readStoredCanvasWidth()).toBeNull();
  });
});

describe('canvasResize editor wiring', () => {
  let editor: Editor;

  beforeEach((done) => {
    global.localStorage.removeItem(CANVAS_WIDTH_KEY);
    editor = grapesjs.init({ container: '#gjs', plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on('change:readyLoad', () => done());
  });

  afterEach(() => {
    editor.destroy();
    global.localStorage.removeItem(CANVAS_WIDTH_KEY);
    global.localStorage.removeItem(CANVAS_DEVICE_KEY);
  });

  test('registers the custom device command', () => {
    expect(editor.Commands.get(cmdDeviceCustom)).toBeTruthy();
  });

  test('setCustomWidth creates/selects Custom device and persists', () => {
    const applied = setCustomWidth(editor, 520, { max: 1200 });
    expect(applied).toBe(520);
    // DeviceManager stores the id; lookup works by id or name.
    expect(editor.Devices.getSelected()?.get('name')).toBe('Custom');
    expect(editor.Devices.get('Custom')?.get('width')).toBe('520px');
    expect(global.localStorage.getItem(CANVAS_WIDTH_KEY)).toBe('520');
  });

  test('setCustomWidth clamps below the minimum', () => {
    expect(setCustomWidth(editor, 50, { max: 1200 })).toBe(CANVAS_WIDTH_MIN);
  });

  test('custom command falls back to stored width', () => {
    global.localStorage.setItem(CANVAS_WIDTH_KEY, '700');
    editor.runCommand(cmdDeviceCustom);
    expect(editor.Devices.getSelected()?.get('name')).toBe('Custom');
    expect(editor.Devices.get('Custom')?.get('width')).toBe('700px');
  });

  test('legacy below-bar badges are removed', () => {
    const badge = document.createElement('span');
    badge.className = 'mjml-canvas-width-badge';
    document.body.appendChild(badge);
    removeLegacyCanvasBadges();
    expect(document.querySelector('.mjml-canvas-width-badge')).toBeFalsy();
  });

  test('decorateFrameWrapper adds grips only once, nothing on the frame bar', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div data-frame-top></div><div data-frame-left></div><div data-frame-right></div>`;
    document.body.appendChild(wrap);
    const slots = {
      elLeft: wrap.querySelector('[data-frame-left]'),
      elRight: wrap.querySelector('[data-frame-right]'),
    };
    decorateFrameWrapper(editor, slots as any, { max: 1200 });
    decorateFrameWrapper(editor, slots as any, { max: 1200 });
    expect(wrap.querySelectorAll('.mjml-frame-grip')).toHaveLength(2);
    // Width readout lives in the top bar control only.
    expect(wrap.querySelector('[data-frame-top]')!.childNodes).toHaveLength(0);
    wrap.remove();
  });

  const pointer = (type: string, clientX: number, target: EventTarget = document) =>
    target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, button: 0 }));

  test('frame grip keeps the edge under the cursor (centered frame → 2×dx)', () => {
    setCustomWidth(editor, 600, { max: 1200 });
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div data-frame-left></div><div data-frame-right></div>`;
    document.body.appendChild(wrap);
    const elRight = wrap.querySelector('[data-frame-right]') as HTMLElement;
    const elLeft = wrap.querySelector('[data-frame-left]') as HTMLElement;
    decorateFrameWrapper(editor, { elRight, elLeft }, { max: 1200 });

    pointer('pointerdown', 1000, elRight);
    pointer('pointermove', 1050);
    // live drag shows a size label and does not persist yet
    expect(wrap.querySelector('.mjml-frame-size.is-on')?.textContent).toBe('700 px');
    expect(global.localStorage.getItem(CANVAS_WIDTH_KEY)).toBe('600');
    pointer('pointerup', 1050);
    expect(getCurrentCanvasWidth(editor)).toBe(700);
    expect(global.localStorage.getItem(CANVAS_WIDTH_KEY)).toBe('700');
    expect(wrap.querySelector('.mjml-frame-size.is-on')).toBeFalsy();

    // left grip: dragging left grows
    pointer('pointerdown', 100, elLeft);
    pointer('pointermove', 50);
    pointer('pointerup', 50);
    expect(getCurrentCanvasWidth(editor)).toBe(800);
    wrap.remove();
  });

  test('double-click on a frame grip goes back to Desktop', () => {
    setCustomWidth(editor, 600, { max: 1200 });
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div data-frame-right></div>`;
    const elRight = wrap.querySelector('[data-frame-right]') as HTMLElement;
    decorateFrameWrapper(editor, { elRight }, { max: 1200 });
    elRight.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(editor.Devices.getSelected()?.get('id')).toBe('desktop');
  });

  test('remembers the last device id', () => {
    trackDevice(editor);
    editor.setDevice('Tablet');
    expect(global.localStorage.getItem(CANVAS_DEVICE_KEY)).toBe('tablet');
  });

  test('getCurrentCanvasWidth reflects the selected device', () => {
    setCustomWidth(editor, 560, { max: 1200 });
    expect(getCurrentCanvasWidth(editor)).toBe(560);
  });
});

describe('device restore on load', () => {
  const boot = (cb: (editor: Editor) => void) => (done: jest.DoneCallback) => {
    const editor = grapesjs.init({ container: '#gjs', plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on('change:readyLoad', () => {
      restoreDevice(editor);
      cb(editor);
      editor.destroy();
      global.localStorage.removeItem(CANVAS_WIDTH_KEY);
      global.localStorage.removeItem(CANVAS_DEVICE_KEY);
      done();
    });
  };

  test('a stored width alone no longer forces Custom', (done) => {
    global.localStorage.setItem(CANVAS_WIDTH_KEY, '700');
    boot((editor) => expect(editor.Devices.getSelected()?.get('id')).toBe('desktop'))(done);
  });

  test('restores Custom at the stored width when it was the last device', (done) => {
    global.localStorage.setItem(CANVAS_WIDTH_KEY, '700');
    global.localStorage.setItem(CANVAS_DEVICE_KEY, 'custom');
    boot((editor) => {
      expect(editor.Devices.getSelected()?.get('id')).toBe('custom');
      expect(getCurrentCanvasWidth(editor)).toBe(700);
    })(done);
  });

  test('restores a preset device', (done) => {
    global.localStorage.setItem(CANVAS_DEVICE_KEY, 'tablet');
    boot((editor) => expect(editor.Devices.getSelected()?.get('id')).toBe('tablet'))(done);
  });
});

describe('top bar', () => {
  let editor: Editor;

  beforeEach((done) => {
    editor = grapesjs.init({ container: '#gjs', plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on('change:readyLoad', () => done());
  });

  afterEach(() => editor.destroy());

  test('options are grouped: history | view | file, with separators', () => {
    const ids = editor.Panels.getPanel('options')!.get('buttons').map((b: any) => b.get('id'));
    expect(ids).toEqual(['undo', 'redo', 'sw-visibility', 'preview', 'fullscreen', cmdImportMjml, cmdExportMenu]);
    const sep = (id: string) => String(editor.Panels.getButton('options', id)?.get('className')).includes('mjml-sep');
    expect(sep('sw-visibility')).toBe(true);
    expect(sep(cmdImportMjml)).toBe(true);
    expect(sep('undo')).toBe(false);
  });

  test('undo/redo are disabled until there is history', () => {
    const undo = editor.Panels.getButton('options', 'undo')!;
    const redo = editor.Panels.getButton('options', 'redo')!;
    expect(undo.get('disable')).toBe(true);
    expect(redo.get('disable')).toBe(true);
    editor.getWrapper()!.append('<mj-section></mj-section>');
    editor.trigger('update');
    expect(undo.get('disable')).toBe(false);
    editor.UndoManager.undo();
    expect(redo.get('disable')).toBe(false);
  });

  test('core buttons use the same SVG icon set as the plugin', () => {
    ['sw-visibility', 'preview', 'fullscreen'].forEach((id) => {
      const btn = editor.Panels.getButton('options', id)!;
      expect(btn.get('className')).not.toMatch(/\bfa\b/);
      expect(btn.get('label')).toContain('<svg');
    });
  });
});
