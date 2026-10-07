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
import { ensureUiStyles } from './ui/styles';

/** Material Design icon paths — one icon family for the whole top bar. */
export const PANEL_ICONS: Record<string, string> = {
  code: 'M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z',
  import: 'M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z',
  export: 'M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z',
  undo: 'M20 13.5C20 17.09 17.09 20 13.5 20H6V18H13.5C16 18 18 16 18 13.5S16 9 13.5 9H7.83L10.91 12.09L9.5 13.5L4 8L9.5 2.5L10.92 3.91L7.83 7H13.5C17.09 7 20 9.91 20 13.5Z',
  redo: 'M10.5 18H18V20H10.5C6.91 20 4 17.09 4 13.5S6.91 7 10.5 7H16.17L13.08 3.91L14.5 2.5L20 8L14.5 13.5L13.09 12.09L16.17 9H10.5C8 9 6 11 6 13.5S8 18 10.5 18Z',
  desktop: 'M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z',
  tablet: 'M19,18H5V6H19M21,4H3C1.89,4 1,4.89 1,6V18A2,2 0 0,0 3,20H21A2,2 0 0,0 23,18V6C23,4.89 22.1,4 21,4Z',
  mobile: 'M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z',
  custom: 'M8,18H11V15H2V9H11V6H8L2,12L8,18M14,6V9H22V15H14V18H16L22,12L16,6H14Z',
  'sw-visibility':
    'M4,3H5V5H3V4A1,1 0 0,1 4,3M20,3A1,1 0 0,1 21,4V5H19V3H20M15,5V3H17V5H15M11,5V3H13V5H11M7,5V3H9V5H7M21,20A1,1 0 0,1 20,21H19V19H21V20M15,21V19H17V21H15M11,21V19H13V21H11M7,21V19H9V21H7M4,21A1,1 0 0,1 3,20V19H5V21H4M3,15H5V17H3V15M21,15V17H19V15H21M3,11H5V13H3V11M21,11V13H19V11H21M3,7H5V9H3V7M21,7V9H19V7H21Z',
  preview:
    'M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z',
  fullscreen: 'M5,5H10V7H7V10H5V5M14,5H19V10H17V7H14V5M17,14H19V19H14V17H17V14M10,17V19H5V14H7V17H10Z',
  'open-sm':
    'M20.71,4.63L19.37,3.29C19,2.9 18.35,2.9 17.96,3.29L9,12.25L11.75,15L20.71,6.04C21.1,5.65 21.1,5 20.71,4.63M7,14A3,3 0 0,0 4,17C4,18.31 2.84,19 2,19C2.92,20.22 4.5,21 6,21A4,4 0 0,0 10,17A3,3 0 0,0 7,14Z',
  'open-tm':
    'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z',
  'open-layers': 'M12,16L19.36,10.27L21,9L12,2L3,9L4.63,10.27M12,18.54L4.62,12.81L3,14.07L12,21.07L21,14.07L19.37,12.8L12,18.54Z',
  'open-blocks': 'M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3',
};

const icon = (name: string) =>
  `<svg class="mjml-pn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${PANEL_ICONS[name]}"/></svg>`;

export const VIEWS_TAB_KEY = 'mjml-views-tab';

/** Device id (DeviceManager) → toolbar button id. */
export const DEVICE_BUTTONS: Record<string, string> = {
  desktop: cmdDeviceDesktop,
  tablet: cmdDeviceTablet,
  mobilePortrait: cmdDeviceMobile,
  custom: cmdDeviceCustom,
};

const modKey = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? '⌘' : 'Ctrl';

const addClass = (btn: any, cls: string) => {
  const current = String(btn?.get?.('className') || '');
  if (!current.split(/\s+/).includes(cls)) btn?.set?.('className', `${current} ${cls}`.trim());
};

export default (editor: Editor, opts: RequiredPluginOptions) => {
  const { Panels } = editor;
  ensureUiStyles();

  const getI18nLabel = (label: string) => editor.I18n.t(`grapesjs-mjml.panels.buttons.${label}`);

  // Remove core's Export (View code) button — code export now lives
  // in the docked code view (MJML + HTML tabs) and the Export menu.
  // The underlying `export-template` command is untouched.
  Panels.removeButton('options', 'export-template');

  // Core buttons: same icon family as ours (core ships Font Awesome glyphs).
  ['sw-visibility', 'preview', 'fullscreen', 'open-sm', 'open-tm', 'open-layers', 'open-blocks'].forEach((id) => {
    const panelId = id.startsWith('open-') ? 'views' : 'options';
    const btn = Panels.getButton(panelId, id);
    btn?.set({ className: '', label: icon(id) });
  });

  // --- Left: code toggle -------------------------------------------------
  Panels.addButton('commands', {
    id: cmdCodeDock,
    command: cmdCodeDock,
    togglable: true,
    // Follow run/stop from anywhere (✕ in the dock, startOpen, API).
    listen: true,
    attributes: { title: `${getI18nLabel('codeDock')} (${modKey}+\`)` },
    label: icon('code'),
  } as any);
  // Drop core's empty placeholder button so the toggle sits alone at far left.
  try {
    const cmdBtns = Panels.getPanel('commands')?.get('buttons');
    cmdBtns?.remove?.(cmdBtns.filter((b: any) => !b.get('id')), { silent: true });
  } catch {
    // Placeholder stays — harmless, just an empty 30px slot.
  }

  // --- Right: [undo redo] | [outline preview fullscreen] | [import export]
  const optBtns: any = Panels.getPanel('options')?.get('buttons');
  const undoRedo = [
    { id: 'undo', command: 'core:undo', togglable: false, attributes: { title: getI18nLabel('undo') }, label: icon('undo') },
    { id: 'redo', command: 'core:redo', togglable: false, attributes: { title: getI18nLabel('redo') }, label: icon('redo') },
  ];
  if (optBtns?.add) optBtns.add(undoRedo, { at: 0 });
  else undoRedo.forEach((b) => Panels.addButton('options', b));

  Panels.addButton('options', {
    id: cmdImportMjml,
    command: cmdImportMjml,
    className: 'mjml-sep',
    attributes: { title: getI18nLabel('import') },
    label: icon('import'),
  });
  // Export menu — MJML source, compiled HTML, or .eml file.
  Panels.addButton('options', {
    id: cmdExportMenu,
    command: cmdExportMenu,
    attributes: { title: getI18nLabel('exportMenu') },
    label: icon('export'),
  });
  // Separator before the first view-mode button that follows redo.
  const afterRedo = optBtns?.at?.((optBtns.indexOf?.(Panels.getButton('options', 'redo')) ?? -2) + 1);
  afterRedo && afterRedo.get('id') !== cmdImportMjml && addClass(afterRedo, 'mjml-sep');

  // Undo/redo reflect whether there is anything to undo/redo.
  const syncUndo = () => {
    const um: any = editor.UndoManager;
    Panels.getButton('options', 'undo')?.set('disable', !um?.hasUndo?.());
    Panels.getButton('options', 'redo')?.set('disable', !um?.hasRedo?.());
  };
  editor.on('update undo redo load', syncUndo);
  syncUndo();

  // Reopen the sidebar tab the user last had open (Styles/Settings/Layers/Blocks).
  // Read now: core activates its default tab on load, which re-saves it.
  const VIEW_TABS = ['open-sm', 'open-tm', 'open-layers', 'open-blocks'];
  const readTab = () => {
    try {
      return globalThis.localStorage?.getItem(VIEWS_TAB_KEY) ?? null;
    } catch {
      return null;
    }
  };
  const lastTab = readTab();
  editor.onReady(() => {
    const btn = lastTab && VIEW_TABS.includes(lastTab) ? Panels.getButton('views', lastTab) : null;
    // Next tick: Layers sets its root on the same `load` event.
    btn && setTimeout(() => !btn.get('active') && btn.set('active', true));
    VIEW_TABS.forEach((id) =>
      editor.on(`run:${id}`, () => {
        try {
          globalThis.localStorage?.setItem(VIEWS_TAB_KEY, id);
        } catch {
          // storage unavailable
        }
      }),
    );
  });

  // --- Devices -------------------------------------------------------------
  if (opts.resetDevices) {
    // Turn off default devices select and create new one
    editor.getConfig().showDevices = false;

    const devicePanel = Panels.addPanel({ id: 'devices-c' } as any);
    const deviceBtns = devicePanel.get('buttons');
    // togglable:false — clicking the active device must not leave none selected.
    const device = (id: string, command: string, title: string, active = false) => ({
      id: command,
      command,
      active,
      togglable: false,
      attributes: { title: getI18nLabel(title) },
      label: icon(id),
    });
    deviceBtns.add([
      device('desktop', cmdDeviceDesktop, 'desktop', true),
      device('tablet', cmdDeviceTablet, 'tablet'),
      device('mobile', cmdDeviceMobile, 'mobile'),
      device('custom', cmdDeviceCustom, 'custom'),
    ]);

    // Highlight follows the real device, whoever changed it (grips, width
    // input, restore on load, API).
    editor.on('device:select', (dev: any) => {
      const btnId = DEVICE_BUTTONS[dev?.get?.('id') ?? dev?.id];
      const btn = btnId && Panels.getButton('devices-c', btnId);
      if (btn && !btn.get('active')) btn.set('active', true, { fromListen: true } as any);
    });
  }
};
