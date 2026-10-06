import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '..';
import { cmdGetMjmlToHtml } from '.';
import { buildEml, downloadEml, EML_DEFAULTS } from '../eml';

export const cmdExportEml = 'mjml-export-eml';

/**
 * Compile the canvas to HTML and download it as a `.eml` file.
 * Returns the EML source (handy for tests / programmatic use).
 * Validation warnings are logged but don't block the download —
 * mjml-browser still emits HTML alongside them.
 */
export default (editor: Editor, opts: RequiredPluginOptions) => {
  const { Commands } = editor;

  Commands.add(cmdExportEml, () => {
    const result = Commands.run(cmdGetMjmlToHtml) ?? {};
    (result.errors ?? []).forEach((error: any) => {
      editor.log(error.formattedMessage ?? String(error), {
        ns: cmdExportEml,
        level: 'warning',
        // @ts-ignore
        error,
      });
    });
    const emlOpts = opts.eml ?? {};
    const eml = buildEml(result.html ?? '', {
      from: emlOpts.from ?? EML_DEFAULTS.from,
      to: emlOpts.to ?? EML_DEFAULTS.to,
      subject: emlOpts.subject ?? EML_DEFAULTS.subject,
    });
    try {
      downloadEml(eml, emlOpts.filename ?? EML_DEFAULTS.filename);
    } catch {
      // No download API (jsdom, blocked popup) — caller still gets the EML.
    }
    return eml;
  });
};
