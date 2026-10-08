import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { cmdImportMjml } from './commands';
import { cmdExportMenu } from './commands/exportMenu';
import { cmdCodeDock } from './codeEditor/toggleCodeDock';
import { mountDeviceBar } from './deviceBar';
import { UiIconName, uiIcon } from './icons';

/** Core buttons re-skinned with the plugin's icon set: [panel, button, icon]. */
const CORE_BUTTON_ICONS: [string, string, UiIconName][] = [
  ['options', 'sw-visibility', 'outline'],
  ['options', 'preview', 'eye'],
  ['options', 'fullscreen', 'fullscreen'],
  ['views', 'open-sm', 'style'],
  ['views', 'open-tm', 'settings'],
  ['views', 'open-layers', 'layers'],
  ['views', 'open-blocks', 'blocks'],
];

/** Top bar polish: one button shape, hover and active state everywhere. */
const PANEL_CSS = `
.gjs-pn-panel.gjs-pn-devices-c { left: 44px; top: 0; height: 40px; padding: 0 5px; display: flex; align-items: center; }
.gjs-pn-commands, .gjs-pn-options, .gjs-pn-views { display: flex; align-items: center; }
.gjs-pn-options .gjs-pn-buttons, .gjs-pn-views .gjs-pn-buttons, .gjs-pn-commands .gjs-pn-buttons { gap: 2px; }
.gjs-pn-commands .gjs-pn-btn, .gjs-pn-options .gjs-pn-btn, .gjs-pn-views .gjs-pn-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 30px; margin: 0; padding: 0; border-radius: 8px;
  opacity: 0.7; transition: opacity 0.15s, background 0.15s, color 0.15s;
}
.gjs-pn-commands .gjs-pn-btn:hover, .gjs-pn-options .gjs-pn-btn:hover, .gjs-pn-views .gjs-pn-btn:hover {
  opacity: 1; background: rgba(255, 255, 255, 0.07);
}
.gjs-pn-commands .gjs-pn-btn.gjs-pn-active, .gjs-pn-options .gjs-pn-btn.gjs-pn-active, .gjs-pn-views .gjs-pn-btn.gjs-pn-active {
  opacity: 1; background: rgba(255, 255, 255, 0.12); box-shadow: none;
}
.gjs-pn-btn > svg { display: block; width: 18px; height: 18px; }
`;

export default (editor: Editor, opts: RequiredPluginOptions) => {
  const { Panels } = editor;
  const t = (label: string) => editor.I18n.t(`grapesjs-mjml.panels.buttons.${label}`);

  // Remove core's Export (View code) button — code export now lives
  // in the docked code view (MJML + HTML tabs). The underlying
  // `export-template` command is untouched for programmatic use.
  Panels.removeButton('options', 'export-template');

  Panels.addButton('options', {
    id: cmdImportMjml,
    command: cmdImportMjml,
    attributes: { title: t('import') },
    label: uiIcon('import'),
  });

  // One Export entry point: MJML source, compiled HTML or .eml file.
  Panels.addButton('options', {
    id: cmdExportMenu,
    command: cmdExportMenu,
    attributes: { title: t('exportMenu') },
    label: uiIcon('export'),
  });

  // Docked code view toggle, far left of the top bar.
  Panels.addButton('commands', {
    id: cmdCodeDock,
    command: cmdCodeDock,
    togglable: true,
    attributes: { title: t('codeDock') },
    label: uiIcon('code'),
  });
  // Drop core's empty placeholder button so the toggle sits alone at far left…
  const cmdBtns = Panels.getPanel('commands')?.get('buttons');
  cmdBtns?.remove(cmdBtns.filter((btn: any) => !btn.get('id')), { silent: true });
  // …and shift the devices panel right, past the toggle. Without this it
  // stacks at x:0 (same z-index, later in DOM) and covers it.
  const style = document.createElement('style');
  style.setAttribute('data-mjml-panels', '');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  Panels.addButton('options', {
    id: 'undo',
    command: 'core:undo',
    attributes: { title: t('undo') },
    label: uiIcon('undo'),
  });
  Panels.addButton('options', {
    id: 'redo',
    command: 'core:redo',
    attributes: { title: t('redo') },
    label: uiIcon('redo'),
  });

  // Core buttons draw their icon through an `fa fa-*` class: drop it, or
  // both icons show.
  CORE_BUTTON_ICONS.forEach(([panel, id, name]) =>
    Panels.getButton(panel, id)?.set({ label: uiIcon(name), className: '' }),
  );

  if (opts.resetDevices) {
    // The device bar (tier switch + width + breakpoints) replaces the core
    // devices select. The `set-device-*` commands stay for programmatic use.
    editor.getConfig().showDevices = false;
    Panels.addPanel({ id: 'devices-c' } as any);
    editor.onReady(() => mountDeviceBar(editor, opts));
  }
};
