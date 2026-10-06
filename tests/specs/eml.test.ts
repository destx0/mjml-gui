import grapesjs, { Editor } from 'grapesjs';
import grapesJSMJML from '../../src';
import { cmdExportEml } from '../../src/commands/exportEml';
import { cmdExportMenu } from '../../src/commands/exportMenu';
import { buildEml, encodeSubject, sanitizeHeader } from '../../src/eml';

const HTML = '<html><body><p>Hello — مرحبا 🎉</p></body></html>';

function decodeBody(eml: string): string {
  const body = eml.split('\r\n\r\n')[1];
  return Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8');
}

describe('buildEml', () => {
  test('emits required MIME headers with CRLF endings', () => {
    const eml = buildEml(HTML, { from: 'a@x.com', to: 'b@x.com', subject: 'Hi' }, new Date('2026-10-06T12:00:00Z'));
    expect(eml).toContain('From: a@x.com\r\n');
    expect(eml).toContain('To: b@x.com\r\n');
    expect(eml).toContain('Subject: Hi\r\n');
    expect(eml).toContain('Date: Tue, 06 Oct 2026 12:00:00 GMT\r\n');
    expect(eml).toMatch(/Message-ID: <.+@mjml-gui>\r\n/);
    expect(eml).toContain('MIME-Version: 1.0\r\n');
    expect(eml).toContain('Content-Type: text/html; charset=UTF-8\r\n');
    expect(eml).toContain('Content-Transfer-Encoding: base64\r\n');
    expect(eml).not.toMatch(/[^\r]\n/);
  });

  test('base64 body round-trips, including unicode', () => {
    expect(decodeBody(buildEml(HTML))).toBe(HTML);
  });

  test('encoded lines stay within 76 chars', () => {
    const longHtml = `<html><body>${'x'.repeat(5000)}</body></html>`;
    const body = buildEml(longHtml).split('\r\n\r\n')[1];
    body.split('\r\n').forEach((line) => expect(line.length).toBeLessThanOrEqual(76));
    expect(decodeBody(buildEml(longHtml))).toBe(longHtml);
  });

  test('strips header injection attempts', () => {
    expect(sanitizeHeader('a@x.com\r\nBcc: evil@x.com')).toBe('a@x.com Bcc: evil@x.com');
    const eml = buildEml(HTML, { subject: 'Hi\r\nX-Evil: 1' });
    expect(eml).not.toMatch(/\r\nX-Evil:/);
    expect(eml).toContain('Subject: Hi X-Evil: 1\r\n');
  });

  test('encodes non-ASCII subjects per RFC 2047', () => {
    expect(encodeSubject('Plain')).toBe('Plain');
    const encoded = encodeSubject('Héllo 🎉');
    expect(encoded).toMatch(/=\?UTF-8\?B\?.+\?=/);
    const eml = buildEml(HTML, { subject: 'Héllo 🎉' });
    expect(eml).toContain(`Subject: ${encoded}\r\n`);
  });

  test('uses defaults when options are omitted', () => {
    const eml = buildEml(HTML);
    expect(eml).toContain('From: sender@example.com\r\n');
    expect(eml).toContain('To: recipient@example.com\r\n');
    expect(eml).toContain('Subject: Email\r\n');
  });
});

describe('eml plugin wiring', () => {
  let editor: Editor;

  beforeEach((done) => {
    editor = grapesjs.init({ container: '#gjs', plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on('change:readyLoad', () => done());
  });

  afterEach(() => {
    editor.destroy();
  });

  test("core Export button is removed from the options panel", () => {
    expect(editor.Panels.getButton('options', 'export-template')).toBeFalsy();
  });

  test('adds Export menu button instead of a standalone .eml button', () => {
    expect(editor.Panels.getButton('options', cmdExportMenu)).toBeTruthy();
    expect(editor.Panels.getButton('options', cmdExportEml)).toBeFalsy();
  });

  test('mjml-export-eml returns EML with the compiled HTML', () => {
    editor.setComponents('<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>');
    const eml = editor.Commands.run(cmdExportEml) as string;
    expect(eml).toContain('Content-Type: text/html; charset=UTF-8\r\n');
    expect(decodeBody(eml)).toContain('Hello');
  });
});
