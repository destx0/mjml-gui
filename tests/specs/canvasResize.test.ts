import grapesjs, { Editor } from 'grapesjs';
import grapesJSMJML from '../../src';
import { cmdDeviceCustom } from '../../src/commands';
import {
  CANVAS_WIDTH_KEY,
  CANVAS_WIDTH_MIN,
  clampCanvasWidth,
  decorateFrameWrapper,
  getCurrentCanvasWidth,
  mountCanvasWidthControl,
  parseWidthPx,
  readStoredCanvasWidth,
  removeLegacyCanvasBadges,
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
    document.querySelectorAll('.mjml-canvas-width-ctl').forEach((el) => el.remove());
  });

  test('registers the custom device command and toolbar button', () => {
    expect(editor.Commands.get(cmdDeviceCustom)).toBeTruthy();
    expect(editor.Panels.getButton('devices-c', cmdDeviceCustom)).toBeTruthy();
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

  test('width input commits a custom width', () => {
    // Panels render only in a real browser layout; mount onto a fake
    // `.gjs-pn-devices-c` to exercise the control wiring in jsdom.
    const panel = document.createElement('div');
    panel.className = 'gjs-pn-devices-c';
    panel.innerHTML = `<div class="gjs-pn-buttons"></div>`;
    document.body.appendChild(panel);
    mountCanvasWidthControl(editor, { max: 1200 });
    const input = panel.querySelector('.mjml-canvas-width-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = '640';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor.Devices.getSelected()?.get('name')).toBe('Custom');
    expect(global.localStorage.getItem(CANVAS_WIDTH_KEY)).toBe('640');
    panel.remove();
  });

  test('control mounts inside the buttons row, not below it', () => {
    const panel = document.createElement('div');
    panel.className = 'gjs-pn-devices-c';
    panel.innerHTML = `<div class="gjs-pn-buttons"></div>`;
    document.body.appendChild(panel);
    mountCanvasWidthControl(editor, { max: 1200 });
    const buttons = panel.querySelector('.gjs-pn-buttons')!;
    expect(buttons.querySelector(':scope > .mjml-canvas-width-ctl')).toBeTruthy();
    panel.remove();
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

  test('getCurrentCanvasWidth reflects the selected device', () => {
    setCustomWidth(editor, 560, { max: 1200 });
    expect(getCurrentCanvasWidth(editor)).toBe(560);
  });
});
