import { makeResizableViews, readStoredViewsWidth, VIEWS_WIDTH_KEY } from '../../src/panelsResize';

describe('makeResizableViews', () => {
  let el: HTMLElement;

  beforeEach(() => {
    global.localStorage.removeItem(VIEWS_WIDTH_KEY);
    el = document.createElement('div');
    el.style.width = '300px';
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
    global.localStorage.removeItem(VIEWS_WIDTH_KEY);
  });

  function drag(fromX: number, toX: number) {
    const grip = el.querySelector('.mjml-views-resize') as HTMLElement;
    grip.dispatchEvent(new MouseEvent('mousedown', { clientX: fromX, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: toX, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  test('inserts a single grip, even when called twice', () => {
    const cleanup = makeResizableViews(el);
    makeResizableViews(el);
    expect(el.querySelectorAll('.mjml-views-resize')).toHaveLength(1);
    cleanup();
  });

  test('dragging left grows the right-anchored sidebar and persists', () => {
    makeResizableViews(el);
    drag(500, 400);
    expect(el.style.width).toBe('400px');
    expect(global.localStorage.getItem(VIEWS_WIDTH_KEY)).toBe('400');
  });

  test('dragging right shrinks, clamped to the minimum', () => {
    makeResizableViews(el);
    drag(100, 900);
    expect(el.style.width).toBe('200px');
  });

  test('restores the persisted width on init', () => {
    global.localStorage.setItem(VIEWS_WIDTH_KEY, '360');
    makeResizableViews(el);
    expect(el.style.width).toBe('360px');
  });

  test('readStoredViewsWidth ignores missing and invalid values', () => {
    expect(readStoredViewsWidth()).toBeNull();
    global.localStorage.setItem(VIEWS_WIDTH_KEY, 'junk');
    expect(readStoredViewsWidth()).toBeNull();
  });

  test('sits below the top bar so a widened sidebar never covers its icons', () => {
    makeResizableViews(el);
    expect(parseInt(el.style.zIndex, 10)).toBeLessThan(3);
  });

  test('cleanup removes the grip', () => {
    const cleanup = makeResizableViews(el);
    cleanup();
    expect(el.querySelector('.mjml-views-resize')).toBeFalsy();
  });
});
