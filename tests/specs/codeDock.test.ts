import grapesjs, { Editor } from 'grapesjs';
import grapesJSMJML from '../../src';
import { cmdCodeDock } from '../../src/codeEditor/toggleCodeDock';
import { createCodeDock, CodeDockDeps, readStoredWidth } from '../../src/codeEditor/dock';
import { formatMjml, registerMjmlLanguage, MJML_TAGS } from '../../src/codeEditor/mjmlLanguage';
import { blockingErrors, validateMjml } from '../../src/codeEditor/validate';
import defaultParser from '../../src/components/parser';

const VALID_MJML = `<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>`;
const COMPILED_HTML = `<html><body>Hello</body></html>`;

function stubEditor(mount: HTMLElement) {
  return { getContainer: () => mount } as unknown as Editor;
}

function stubDeps(overrides: Partial<CodeDockDeps> = {}): CodeDockDeps & { writeMjml: jest.Mock } {
  const writeMjml = jest.fn();
  return {
    loadMonaco: () => new Promise(() => {}), // never resolves -> fallback textareas
    readMjml: () => VALID_MJML,
    compileMjml: () => ({ html: COMPILED_HTML, errors: [] }),
    ...overrides,
    writeMjml: (overrides.writeMjml ?? writeMjml) as jest.Mock,
  };
}

describe('codeDock command wiring', () => {
  let editor: Editor;

  beforeEach((done) => {
    editor = grapesjs.init({ container: '#gjs', plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on('change:readyLoad', () => done());
  });

  afterEach(() => {
    editor.destroy();
  });

  test('registers mjml-code-dock command', () => {
    expect(editor.Commands.get(cmdCodeDock)).toBeTruthy();
  });

  test('adds toggle button to options panel', () => {
    const btn = editor.Panels.getButton('options', cmdCodeDock);
    expect(btn).toBeTruthy();
  });
});

describe('createCodeDock (fallback textareas, no Monaco)', () => {
  let mount: HTMLElement;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    mount.remove();
  });

  test('refresh fills formatted MJML + HTML and starts clean', () => {
    const deps = stubDeps();
    const dock = createCodeDock(stubEditor(mount), {}, { ...deps, mountTo: () => mount });
    dock.open();
    expect(dock.isOpen()).toBe(true);
    expect(dock.getMjml()).toBe(formatMjml(VALID_MJML));
    expect(dock.isDirty()).toBe(false);
    dock.destroy();
  });

  test('editing marks dirty, valid apply writes to canvas', () => {
    const deps = stubDeps();
    const dock = createCodeDock(stubEditor(mount), {}, { ...deps, mountTo: () => mount });
    dock.open();
    dock.setMjml(`${VALID_MJML} `);
    expect(dock.isDirty()).toBe(true);
    const result = dock.apply();
    expect(result).toEqual({ applied: true, errors: [] });
    expect(deps.writeMjml).toHaveBeenCalledTimes(1);
    expect(dock.isDirty()).toBe(false);
    dock.destroy();
  });

  test('invalid MJML blocks apply and shows banner', () => {
    const errors = [{ formattedMessage: 'Validation error: <mj-foo> is not allowed' }];
    const deps = stubDeps({ compileMjml: () => ({ html: '', errors }) });
    const dock = createCodeDock(stubEditor(mount), {}, { ...deps, mountTo: () => mount });
    dock.open();
    const result = dock.apply();
    expect(result.applied).toBe(false);
    expect(result.errors).toBe(errors);
    expect(deps.writeMjml).not.toHaveBeenCalled();
    expect(dock.el.textContent).toContain('Apply blocked');
    dock.destroy();
  });

  test('toggle opens and closes', () => {
    const dock = createCodeDock(stubEditor(mount), {}, { ...stubDeps(), mountTo: () => mount });
    expect(dock.toggle()).toBe(true);
    expect(dock.toggle()).toBe(false);
    dock.destroy();
  });

  test('uses native GrapesJS chrome (panel bg class, gjs buttons, editor font)', () => {
    const dock = createCodeDock(stubEditor(mount), {}, { ...stubDeps(), mountTo: () => mount });
    // Same background class as the GrapesJS top bar (themed via gjs-one-bg).
    expect(dock.el.querySelectorAll('.gjs-one-bg').length).toBeGreaterThanOrEqual(2);
    // Action buttons reuse the native primary button (Import modal look).
    expect(dock.el.querySelectorAll('.gjs-btn-prim').length).toBeGreaterThanOrEqual(5);
    // Same typeface as .gjs-editor.
    expect(dock.el.style.fontFamily).toContain('Helvetica');
    dock.destroy();
  });

  test('mounts on the left by default, right on request', () => {
    const left = createCodeDock(stubEditor(mount), {}, { ...stubDeps(), mountTo: () => mount });
    expect(mount.firstChild).toBe(left.el);
    left.destroy();

    const right = createCodeDock(stubEditor(mount), { side: 'right' }, { ...stubDeps(), mountTo: () => mount });
    expect(mount.lastChild).toBe(right.el);
    right.destroy();
  });

  test('drag on the grip resizes and persists width', () => {
    global.localStorage.removeItem('mjml-code-dock-width');
    const dock = createCodeDock(stubEditor(mount), { width: 400 }, { ...stubDeps(), mountTo: () => mount });
    const grip = dock.el.querySelector('.mjml-code-dock-resize') as HTMLElement;
    expect(grip).toBeTruthy();

    grip.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 180, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(dock.el.style.flex).toContain('480px');
    expect(global.localStorage.getItem('mjml-code-dock-width')).toBe('480');
    dock.destroy();
    global.localStorage.removeItem('mjml-code-dock-width');
  });

  test('resize clamps to the minimum width', () => {
    const dock = createCodeDock(stubEditor(mount), { width: 400 }, { ...stubDeps(), mountTo: () => mount });
    const grip = dock.el.querySelector('.mjml-code-dock-resize') as HTMLElement;

    grip.dispatchEvent(new MouseEvent('mousedown', { clientX: 500, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(dock.el.style.flex).toContain('280px');
    dock.destroy();
    global.localStorage.removeItem('mjml-code-dock-width');
  });

  test('readStoredWidth ignores missing and invalid values', () => {
    global.localStorage.removeItem('mjml-code-dock-width');
    expect(readStoredWidth()).toBeNull();
    global.localStorage.setItem('mjml-code-dock-width', 'junk');
    expect(readStoredWidth()).toBeNull();
    global.localStorage.removeItem('mjml-code-dock-width');
  });
});

describe('formatMjml', () => {
  test('nests tags with 2-space indentation', () => {
    expect(formatMjml('<mjml><mj-body><mj-text>Hello</mj-text></mj-body></mjml>')).toBe(
      ['<mjml>', '  <mj-body>', '    <mj-text>Hello</mj-text>', '  </mj-body>', '</mjml>'].join('\n'),
    );
  });

  test('void elements do not open an indentation level', () => {
    const out = formatMjml('<mj-section><mj-column><mj-image src="a.png"/><mj-text>Hi</mj-text></mj-column></mj-section>');
    expect(out).toBe(
      ['<mj-section>', '  <mj-column>', '    <mj-image src="a.png"/>', '    <mj-text>Hi</mj-text>', '  </mj-column>', '</mj-section>'].join('\n'),
    );
  });

  test('comments and sibling blocks stay aligned', () => {
    const out = formatMjml('<!-- Hi --><mj-section><mj-column><mj-text>A</mj-text></mj-column></mj-section>');
    expect(out.split('\n')[0]).toBe('<!-- Hi -->');
    expect(out).toContain('\n<mj-section>');
  });

  test('keeps mj-style CSS on one line when short, verbatim when multiline', () => {
    expect(formatMjml('<mj-head><mj-style>.a { color: red; }</mj-style></mj-head>')).toBe(
      ['<mj-head>', '  <mj-style>.a { color: red; }</mj-style>', '</mj-head>'].join('\n'),
    );
    const multi = '<mj-head><mj-style>\n.a { color: red; }\n.b { color: blue; }\n</mj-style></mj-head>';
    expect(formatMjml(multi)).toBe(
      ['<mj-head>', '  <mj-style>', '    .a { color: red; }', '    .b { color: blue; }', '  </mj-style>', '</mj-head>'].join('\n'),
    );
  });

  test('is idempotent', () => {
    const once = formatMjml(VALID_MJML);
    expect(formatMjml(once)).toBe(once);
    expect(once).toContain('\n');
  });
});

describe('registerMjmlLanguage', () => {
  function fakeMonaco() {
    return {
      languages: {
        getLanguages: () => [],
        register: jest.fn(),
        setLanguageConfiguration: jest.fn(),
        setMonarchTokensProvider: jest.fn(),
        registerCompletionItemProvider: jest.fn(),
        registerDocumentFormattingEditProvider: jest.fn(),
        IndentAction: { Indent: 1, IndentOutdent: 2 },
        CompletionItemKind: { Snippet: 1 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 1 },
      },
    };
  }

  test('registers language, config, tokens, completions and formatter', () => {
    const monaco = fakeMonaco();
    registerMjmlLanguage(monaco);
    expect(monaco.languages.register).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mjml' }),
    );
    expect(monaco.languages.setLanguageConfiguration).toHaveBeenCalledWith('mjml', expect.objectContaining({
      comments: { blockComment: ['<!--', '-->'] },
    }));
    expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith('mjml', expect.anything());
    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith('mjml', expect.anything());
    expect(monaco.languages.registerDocumentFormattingEditProvider).toHaveBeenCalledWith('mjml', expect.anything());
  });

  test('is idempotent per monaco instance', () => {
    const monaco = fakeMonaco();
    registerMjmlLanguage(monaco);
    registerMjmlLanguage(monaco);
    expect(monaco.languages.register).toHaveBeenCalledTimes(1);
  });

  test('completion provider suggests mj- tags with closing snippet', () => {
    const monaco = fakeMonaco();
    registerMjmlLanguage(monaco);
    const provider = (monaco.languages.registerCompletionItemProvider as jest.Mock).mock.calls[0][1];
    const { suggestions } = provider.provideCompletionItems();
    const names = suggestions.map((s: any) => s.label);
    expect(names).toEqual(expect.arrayContaining(['mj-section', 'mj-text', 'mj-image']));
    expect(names.length).toBe(MJML_TAGS.length);
    expect(suggestions[0].insertText).toContain('</');
  });

  test('mj-style opens a CSS tokenizer state closed by </mj-style>', () => {
    const monaco = fakeMonaco();
    registerMjmlLanguage(monaco);
    const grammar = (monaco.languages.setMonarchTokensProvider as jest.Mock).mock.calls[0][1];
    const states = Object.keys(grammar.tokenizer);

    // <mj-style> branches to CSS mode; generic tags are untouched.
    expect(states).toEqual(expect.arrayContaining(['styleContent', 'mjStyleTagBody', 'cssComment']));
    const openTagSrc = grammar.tokenizer.openTag.map((r: any) => String(r[0])).join('\n');
    expect(openTagSrc).toContain('mj-style');

    // CSS state tokenizes selectors, properties, braces and exits on close.
    const styleSrc = grammar.tokenizer.styleContent.map((r: any) => String(r[0])).join('\n');
    expect(styleSrc).toContain('mj-style');
    expect(styleSrc).toContain('[{}]');
    const cssClose = grammar.tokenizer.styleContent[1];
    expect(String(cssClose[0])).toContain('mj-style');
    expect(cssClose[2]).toBe('@pop');
  });

  test('formatting provider delegates to formatMjml', () => {
    const monaco = fakeMonaco();
    registerMjmlLanguage(monaco);
    const provider = (monaco.languages.registerDocumentFormattingEditProvider as jest.Mock).mock.calls[0][1];
    const model = {
      getValue: () => '<mjml><mj-text>Hi</mj-text></mjml>',
      getFullModelRange: () => ({ startLineNumber: 1 }),
    };
    expect(provider.provideDocumentFormattingEdits(model)).toEqual([
      { range: { startLineNumber: 1 }, text: formatMjml('<mjml><mj-text>Hi</mj-text></mjml>') },
    ]);
  });
});

describe('validateMjml (real mjml-browser parser)', () => {
  test('valid MJML compiles without errors', () => {
    const { errors, html } = validateMjml(defaultParser, VALID_MJML);
    expect(errors).toHaveLength(0);
    expect(html).toContain('Hello');
  });

  test('unknown component reports errors', () => {
    const bad = `<mjml><mj-body><mj-foo>bar</mj-foo></mj-body></mjml>`;
    const { errors } = validateMjml(defaultParser, bad);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('blockingErrors passes through list, defaults empty', () => {
    expect(blockingErrors([])).toEqual([]);
    expect(blockingErrors(undefined)).toEqual([]);
    const errs = [{ formattedMessage: 'x' }];
    expect(blockingErrors(errs)).toBe(errs);
  });
});
