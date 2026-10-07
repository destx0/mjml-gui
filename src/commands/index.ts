import type { Editor } from 'grapesjs';
import { CommandOptionsMjmlToHtml, RequiredPluginOptions } from '..';
import { setCustomWidth, readStoredCanvasWidth } from '../canvasResize';
import { mjmlConvert } from '../components/utils';
import exportEml from './exportEml';
import exportMenu from './exportMenu';
import openExportMjml from './openExportMjml';
import openImportMjml from './openImportMjml';

export const cmdDeviceDesktop = 'set-device-desktop';
export const cmdDeviceTablet = 'set-device-tablet';
export const cmdDeviceMobile = 'set-device-mobile';
export const cmdDeviceCustom = 'set-device-custom';
export const cmdImportMjml = 'mjml-import';
export const cmdExportMjml = 'mjml-export';
export const cmdGetMjml = 'mjml-code';
export const cmdGetMjmlToHtml = 'mjml-code-to-html';

export default (editor: Editor, opts: RequiredPluginOptions) => {
  const { Commands } = editor;
  const cmdOpenExport = opts.overwriteExport ? 'export-template' : cmdExportMjml;

  Commands.add(cmdGetMjml, () => {
    return `${opts.preMjml}${editor.getHtml().trim()}${opts.postMjml}`;
  });

  Commands.add(cmdGetMjmlToHtml, (ed, _, opt) => {
    const { mjml, ...rest } = (opt || {}) as CommandOptionsMjmlToHtml;
    const mjmlToParse = mjml || Commands.run(cmdGetMjml);
    return mjmlConvert(opts.mjmlParser, mjmlToParse, opts.fonts, rest);
  });

  openExportMjml(editor, opts, cmdOpenExport);
  openImportMjml(editor, opts, cmdImportMjml);
  exportEml(editor, opts);
  exportMenu(editor, opts);

  // Device commands
  Commands.add(cmdDeviceDesktop, {
    run: (ed) => ed.setDevice('Desktop'),
    stop: () => {},
  });
  Commands.add(cmdDeviceTablet, {
    run: (ed) => ed.setDevice('Tablet'),
    stop: () => {},
  });
  Commands.add(cmdDeviceMobile, {
    run: (ed) => ed.setDevice('Mobile portrait'),
    stop: () => {},
  });
  Commands.add(cmdDeviceCustom, {
    run: (ed, _, opt) => {
      const raw = (opt as any)?.width;
      const parsed = typeof raw === 'number' ? raw : parseInt(raw, 10);
      setCustomWidth(ed, Number.isFinite(parsed) ? parsed : (readStoredCanvasWidth() ?? 600));
    },
    stop: () => {},
  });
};
