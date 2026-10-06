import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '..';
import { cmdGetMjml, cmdGetMjmlToHtml } from '../commands';
import { mjmlConvert } from '../components/utils';
import { createCodeDock, CodeDockHandle } from './dock';
import { loadMonaco } from './monacoLoader';

export const cmdCodeDock = 'mjml-code-dock';

export default (editor: Editor, opts: RequiredPluginOptions) => {
  const { Commands } = editor;
  let dock: CodeDockHandle | null = null;
  let senderRef: any = null;

  const getDock = () => {
    if (!dock) {
      dock = createCodeDock(
        editor,
        { width: opts.codeDock?.width, side: opts.codeDock?.side ?? 'left' },
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
        },
      );
      const onKey = (ev: KeyboardEvent) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && dock?.isOpen()) {
          ev.preventDefault();
          dock.apply();
        }
      };
      document.addEventListener('keydown', onKey);
      const prevDestroy = dock.destroy.bind(dock);
      dock.destroy = () => {
        document.removeEventListener('keydown', onKey);
        prevDestroy();
        dock = null;
      };
    }
    return dock;
  };

  Commands.add(cmdCodeDock, {
    run(_ed: Editor, sender: any) {
      senderRef = sender ?? null;
      senderRef?.set?.('active', true);
      getDock().open();
    },
    stop() {
      getDock().close();
      senderRef?.set?.('active', false);
      senderRef = null;
    },
  });

  if (opts.codeDock?.startOpen) {
    editor.onReady(() => Commands.run(cmdCodeDock));
  }
};
