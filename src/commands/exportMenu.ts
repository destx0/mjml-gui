import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '..';
import { cmdGetMjml, cmdGetMjmlToHtml } from '.';
import { cmdExportEml } from './exportEml';
import { downloadFile } from '../exportFiles';

export const cmdExportMenu = 'mjml-export-menu';
export const cmdDownloadMjml = 'mjml-download-mjml';
export const cmdDownloadHtml = 'mjml-download-html';

/**
 * Export menu — one modal, three downloads: MJML source, compiled HTML,
 * and the .eml MIME message. Buttons use the native `gjs-btn-prim` class,
 * like the Import modal.
 */
export default (editor: Editor, _opts: RequiredPluginOptions) => {
  const { Commands } = editor;
  const pfx = editor.getConfig().stylePrefix || 'gjs-';
  const t = (key: string) => editor.I18n.t(`grapesjs-mjml.panels.exportMenu.${key}`);

  Commands.add(cmdDownloadMjml, () => {
    const mjml = Commands.run(cmdGetMjml);
    try {
      downloadFile(mjml, 'template.mjml', 'application/xml');
    } catch {
      // No download API (jsdom, blocked popup) — caller still gets the content.
    }
    return mjml;
  });

  Commands.add(cmdDownloadHtml, () => {
    const { html } = Commands.run(cmdGetMjmlToHtml) ?? {};
    try {
      downloadFile(html ?? '', 'template.html', 'text/html');
    } catch {
      // No download API — caller still gets the content.
    }
    return html ?? '';
  });

  const row = (titleKey: string, descKey: string, cmdId: string) => {
    const el = document.createElement('div');
    el.className = 'mjml-export-row';
    el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid rgba(255,255,255,0.08);';

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;';
    title.textContent = t(titleKey);
    const desc = document.createElement('div');
    desc.style.cssText = 'color:#999;font-size:12px;margin-top:2px;';
    desc.textContent = t(descKey);
    info.append(title, desc);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${pfx}btn-prim`;
    btn.textContent = t('download');
    btn.onclick = () => {
      Commands.run(cmdId);
      editor.Modal.close();
    };

    el.append(info, btn);
    return el;
  };

  Commands.add(cmdExportMenu, {
    run(_ed: unknown, sender: any = {}) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'min-width:min(420px,80vw);';
      wrap.append(
        row('mjmlTitle', 'mjmlDesc', cmdDownloadMjml),
        row('htmlTitle', 'htmlDesc', cmdDownloadHtml),
        row('emlTitle', 'emlDesc', cmdExportEml),
      );
      editor.Modal.open({ title: t('title'), content: wrap }).onceClose(() => {
        sender.set && sender.set('active', false);
        editor.stopCommand(cmdExportMenu);
      });
    },
    stop() {
      editor.Modal.close();
    },
  });
};
