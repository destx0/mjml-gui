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
import { IconName, iconPaths } from './icons';
import { ensureUiStyles } from './ui/styles';

/** Top-bar icon (shared paths, sized by `.mjml-pn-icon` in ui/styles.ts). */
const icon = (name: IconName) =>
  `<svg class="mjml-pn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${iconPaths[name]}"/></svg>`;

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
    btn?.set({ className: '', label: icon(id as IconName) });
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
    const device = (id: IconName, command: string, title: string, active = false) => ({
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
