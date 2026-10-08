import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { cmdImportMjml } from './commands';
import { cmdExportMenu } from './commands/exportMenu';
import { cmdCodeDock } from './codeEditor/toggleCodeDock';
import { mountDeviceBar } from './deviceBar';
import { UiIconName, uiIcon } from './icons';
import { ensureUiStyles } from './ui/styles';

export const VIEWS_TAB_KEY = 'mjml-views-tab';

const modKey = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? '⌘' : 'Ctrl';

const addClass = (btn: any, cls: string) => {
  const current = String(btn?.get?.('className') || '');
  if (!current.split(/\s+/).includes(cls)) btn?.set?.('className', `${current} ${cls}`.trim());
};

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
  ensureUiStyles();

  const t = (label: string) => editor.I18n.t(`grapesjs-mjml.panels.buttons.${label}`);

  // Remove core's Export (View code) button — code export now lives
  // in the docked code view (MJML + HTML tabs) and the Export menu.
  // The underlying `export-template` command is untouched.
  Panels.removeButton('options', 'export-template');

  // Docked code view toggle, far left of the top bar.
  Panels.addButton('commands', {
    id: cmdCodeDock,
    command: cmdCodeDock,
    togglable: true,
    // Follow run/stop from anywhere (✕ in the dock, startOpen, API).
    listen: true,
    attributes: { title: `${t('codeDock')} (${modKey}+\`)` },
    label: uiIcon('code'),
  } as any);
  // Drop core's empty placeholder button so the toggle sits alone at far left.
  try {
    const cmdBtns = Panels.getPanel('commands')?.get('buttons');
    cmdBtns?.remove?.(cmdBtns.filter((btn: any) => !btn.get('id')), { silent: true });
  } catch {
    // Placeholder stays — harmless, just an empty 30px slot.
  }

  // Panel polish (button shape, hover/active state, devices panel offset past
  // the code toggle — without it the panel stacks at x:0 and covers it).
  if (!document.head.querySelector('style[data-mjml-panels]')) {
    const style = document.createElement('style');
    style.setAttribute('data-mjml-panels', '');
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
  }

  // Core buttons draw their icon through an `fa fa-*` class: drop it, or
  // both icons show.
  CORE_BUTTON_ICONS.forEach(([panel, id, name]) =>
    Panels.getButton(panel, id)?.set({ label: uiIcon(name), className: '' }),
  );

  // --- Right: [undo redo] | [outline preview fullscreen] | [import export]
  const optBtns: any = Panels.getPanel('options')?.get('buttons');
  const undoRedo = [
    { id: 'undo', command: 'core:undo', togglable: false, attributes: { title: t('undo') }, label: uiIcon('undo') },
    { id: 'redo', command: 'core:redo', togglable: false, attributes: { title: t('redo') }, label: uiIcon('redo') },
  ];
  if (optBtns?.add) optBtns.add(undoRedo, { at: 0 });
  else undoRedo.forEach((b) => Panels.addButton('options', b));

  Panels.addButton('options', {
    id: cmdImportMjml,
    command: cmdImportMjml,
    className: 'mjml-sep',
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

  if (opts.resetDevices) {
    // The device bar (tier switch + width + breakpoints) replaces the core
    // devices select. The `set-device-*` commands stay for programmatic use.
    editor.getConfig().showDevices = false;
    Panels.addPanel({ id: 'devices-c' } as any);
    editor.onReady(() => mountDeviceBar(editor, opts));
  }
};
