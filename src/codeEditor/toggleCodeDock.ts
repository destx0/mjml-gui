import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '..';
import { cmdGetMjml } from '../commands';
import { mjmlConvert } from '../components/utils';
import { getLayout } from '../ui/layout';
import { createCodeDock, CodeDockHandle } from './dock';
import { loadMonaco } from './monacoLoader';

export const cmdCodeDock = 'mjml-code-dock';

/** Keyboard shortcut for the code view (keymaster syntax). */
export const CODE_DOCK_KEYS = '⌘+`, ctrl+`';

/** Debounce for canvas → dock sync while the dock is open. */
const CANVAS_SYNC_MS = 300;

export default (editor: Editor, opts: RequiredPluginOptions) => {
  const { Commands } = editor;
  let dock: CodeDockHandle | null = null;

  const getDock = () => {
    if (!dock) {
      const layout = getLayout(editor);
      dock = createCodeDock(
        editor,
        {
          width: opts.codeDock?.width,
          side: opts.codeDock?.side ?? 'left',
          tagColorizer: opts.codeDock?.tagColorizer ?? true,
        },
        {
          loadMonaco: () => loadMonaco(opts.codeDock?.cdnUrl),
          readMjml: () => Commands.run(cmdGetMjml),
          compileMjml: (mjml: string) => {
            const result = mjmlConvert(opts.mjmlParser, mjml, opts.fonts ?? {});
            return { html: result?.html ?? '', errors: result?.errors ?? [] };
          },
          writeMjml: (mjml: string) => {
            editor.Components.getWrapper()?.set('content', '');
            editor.setComponents(mjml.trim());
          },
          mountTo: () => layout.editorEl,
          maxWidth: () => layout.maxDockWidth(),
          onLayout: ({ open, width, side }) => layout.setDockWidth(side, open ? width : 0),
          // ✕ (and Ctrl/⌘+` inside Monaco) go through the command so the
          // toolbar toggle stays in sync.
          onCloseRequest: () => editor.stopCommand(cmdCodeDock),
        },
      );

      // Keep the dock in step with canvas edits (auto-reload when clean,
      // conflict bar when the code has unsaved edits).
      let timer: ReturnType<typeof setTimeout> | null = null;
      const onCanvasUpdate = () => {
        if (!dock?.isOpen()) return;
        timer && clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          dock?.notifyCanvasChanged();
        }, CANVAS_SYNC_MS);
      };
      editor.on('update', onCanvasUpdate);

      const prevDestroy = dock.destroy.bind(dock);
      dock.destroy = () => {
        timer && clearTimeout(timer);
        editor.off('update', onCanvasUpdate);
        prevDestroy();
        dock = null;
      };
      editor.on('destroy', () => dock?.destroy());
    }
    return dock;
  };

  Commands.add(cmdCodeDock, {
    run() {
      getDock().open();
    },
    stop() {
      dock?.close();
    },
  });

  // Ctrl/⌘+` toggles the code view (outside text inputs — Monaco binds its own).
  const toggle = () => (Commands.isActive(cmdCodeDock) ? editor.stopCommand(cmdCodeDock) : editor.runCommand(cmdCodeDock));
  editor.Keymaps?.add?.('mjml:toggle-code-dock', CODE_DOCK_KEYS, toggle, { prevent: true } as any);

  if (opts.codeDock?.startOpen) {
    editor.onReady(() => editor.runCommand(cmdCodeDock));
  }
};
