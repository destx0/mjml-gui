import grapesjs, { Editor } from 'grapesjs';
import grapesJSMJML from '../../src';
import { cmdDownloadHtml, cmdDownloadMjml, cmdExportMenu } from '../../src/commands/exportMenu';

const MJML = '<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>';

describe('export menu', () => {
  let editor: Editor;

  beforeEach((done) => {
    editor = grapesjs.init({ container: '#gjs', plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on('change:readyLoad', () => done());
  });

  afterEach(() => {
    try {
      editor.Modal.close();
    } catch {
      // already closed
    }
    editor.destroy();
    document.querySelectorAll('.mjml-export-row').forEach((el) => el.remove());
  });

  test('registers menu and download commands', () => {
    expect(editor.Commands.get(cmdExportMenu)).toBeTruthy();
    expect(editor.Commands.get(cmdDownloadMjml)).toBeTruthy();
    expect(editor.Commands.get(cmdDownloadHtml)).toBeTruthy();
  });

  test('opens a modal with MJML / HTML / EML rows and native buttons', () => {
    editor.Commands.run(cmdExportMenu);
    // Modal renders inside the editor element (detached in jsdom), not document.
    const contentEl = editor.Modal.getContentEl() as HTMLElement;
    const rows = Array.from(contentEl.querySelectorAll('.mjml-export-row'));
    expect(rows).toHaveLength(3);
    const text = rows.map((r) => r.textContent).join('\n');
    expect(text).toContain('MJML');
    expect(text).toContain('HTML');
    expect(text).toContain('EML');
    rows.forEach((row) => {
      expect(row.querySelectorAll('.gjs-btn-prim')).toHaveLength(1);
    });
  });

  test('row Download closes the modal', () => {
    editor.setComponents(MJML);
    editor.Commands.run(cmdExportMenu);
    const contentEl = editor.Modal.getContentEl() as HTMLElement;
    const firstBtn = contentEl.querySelector('.mjml-export-row .gjs-btn-prim') as HTMLButtonElement;
    expect(editor.Modal.isOpen()).toBe(true);
    firstBtn.click();
    expect(editor.Modal.isOpen()).toBe(false);
  });

  test('mjml-download-mjml returns the canvas MJML source', () => {
    editor.setComponents(MJML);
    const mjml = editor.Commands.run(cmdDownloadMjml) as string;
    expect(mjml).toContain('<mj-text>Hello</mj-text>');
  });

  test('mjml-download-html returns the compiled HTML', () => {
    editor.setComponents(MJML);
    const html = editor.Commands.run(cmdDownloadHtml) as string;
    expect(html).toContain('Hello');
    expect(html).toContain('<html');
  });
});
