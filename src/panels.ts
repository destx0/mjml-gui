import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import {
  cmdDeviceCustom,
  cmdDeviceDesktop,
  cmdDeviceMobile,
  cmdDeviceTablet,
  cmdImportMjml,
} from './commands';
import { cmdExportMenu } from './commands/exportMenu';
import { cmdCodeDock } from './codeEditor/toggleCodeDock';
import { CUSTOM_DEVICE_ID } from './canvasResize';
import { icon } from './icons';

/** Device id (GrapesJS defaults + our custom one) → top-bar button. */
const DEVICE_BUTTONS: Record<string, string> = {
  desktop: cmdDeviceDesktop,
  tablet: cmdDeviceTablet,
  mobilePortrait: cmdDeviceMobile,
  [CUSTOM_DEVICE_ID]: cmdDeviceCustom,
};

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
    label: icon('import'),
  });

  // One Export entry point: MJML source, compiled HTML or .eml file.
  Panels.addButton('options', {
    id: cmdExportMenu,
    command: cmdExportMenu,
    attributes: { title: t('exportMenu') },
    label: icon('export'),
  });

  // Docked code view toggle, far left of the top bar.
  Panels.addButton('commands', {
    id: cmdCodeDock,
    command: cmdCodeDock,
    togglable: true,
    attributes: { title: t('codeDock') },
    label: icon('code'),
  });
  // Drop core's empty placeholder button so the toggle sits alone at far left…
  const cmdBtns = Panels.getPanel('commands')?.get('buttons');
  cmdBtns?.remove(cmdBtns.filter((btn: any) => !btn.get('id')), { silent: true });
  // …and shift the unpositioned devices panel right, past the toggle.
  // Without this it stacks at x:0 (same z-index, later in DOM) and covers it.
  const style = document.createElement('style');
  style.setAttribute('data-mjml-panels', '');
  style.textContent = '.gjs-pn-panel.gjs-pn-devices-c{left:40px;}';
  document.head.appendChild(style);

  Panels.addButton('options', {
    id: 'undo',
    command: 'core:undo',
    attributes: { title: t('undo') },
    label: icon('undo'),
  });
  Panels.addButton('options', {
    id: 'redo',
    command: 'core:redo',
    attributes: { title: t('redo') },
    label: icon('redo'),
  });

  if (opts.resetDevices) {
    // Replace the default devices select with icon buttons
    editor.getConfig().showDevices = false;

    const devicePanel = Panels.addPanel({ id: 'devices-c' } as any);
    devicePanel.get('buttons').add([
      { id: cmdDeviceDesktop, label: icon('desktop'), attributes: { title: t('desktop') }, active: true },
      { id: cmdDeviceTablet, label: icon('tablet'), attributes: { title: t('tablet') } },
      { id: cmdDeviceMobile, label: icon('mobile'), attributes: { title: t('mobile') } },
      { id: cmdDeviceCustom, label: icon('custom'), attributes: { title: t('custom') } },
    ].map((btn) => ({ ...btn, command: btn.id })));

    // Keep the highlighted button in sync when the device changes from
    // elsewhere (responsive tier switch, canvas resize grips…).
    // `fromListen` updates the state without re-running the command.
    editor.on('device:select', (device: any) => {
      const btn = devicePanel.get('buttons').get(DEVICE_BUTTONS[device?.id]);
      btn && !btn.get('active') && btn.set('active', true, { fromListen: true });
    });
  }
};
