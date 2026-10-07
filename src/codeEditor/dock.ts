import type { Editor } from 'grapesjs';
import { formatMjml, registerMjmlLanguage } from './mjmlLanguage';
import { enableTagColorizer } from './tagColorizer';
import { blockingErrors } from './validate';

export interface CodeDockDeps {
  loadMonaco: () => Promise<any>;
  /** MJML source of truth from the canvas (cmdGetMjml). */
  readMjml: () => string;
  /** Compile MJML (mjmlConvert). Used for the HTML tab + Apply validation. */
  compileMjml: (mjml: string) => { html: string; errors: any[] };
  /** Write MJML back to the canvas (setComponents path). */
  writeMjml: (mjml: string) => void;
  /** Where to append the dock. Defaults to the editor container (flex split). */
  mountTo?: () => HTMLElement | null;
}

export interface CodeDockOptions {
  width?: number;
  side?: 'left' | 'right';
  /**
   * Tag-pair colorizer: same tag name always gets the same color, so a
   * matching `<mj-section> … </mj-section>` pair is easy to spot.
   * @default true
   */
  tagColorizer?: boolean;
}

export interface CodeDockHandle {
  el: HTMLElement;
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => boolean;
  refresh: () => void;
  apply: () => { applied: boolean; errors: any[] };
  isDirty: () => boolean;
  getMjml: () => string;
  setMjml: (value: string) => void;
  isColorizerEnabled: () => boolean;
  setColorizerEnabled: (on: boolean) => void;
  destroy: () => void;
}

const DOCK_WIDTH_DEFAULT = 480;
const DOCK_WIDTH_MIN = 280;
const DOCK_WIDTH_KEY = 'mjml-code-dock-width';

/** Test seam: persisted dock width. */
export function readStoredWidth(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(DOCK_WIDTH_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= DOCK_WIDTH_MIN ? parsed : null;
  } catch {
    return null;
  }
}

function storeWidth(width: number) {
  try {
    globalThis.localStorage?.setItem(DOCK_WIDTH_KEY, String(Math.round(width)));
  } catch {
    // storage unavailable (private mode, SSR) — width stays in memory
  }
}

function tabButton(label: string) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.style.cssText =
    'background:transparent;border:none;color:#ddd;padding:6px 12px;cursor:pointer;font:inherit;';
  return btn;
}

function toolbarButton(label: string, title: string) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.title = title;
  // Native GrapesJS primary button (same as the Import modal button).
  btn.className = 'gjs-btn-prim';
  btn.style.cssText = 'margin-left:6px;font:inherit;font-size:12px;';
  return btn;
}

/**
 * Docked Monaco code view (P0 spike).
 * MJML tab is editable + Apply-gated; HTML tab is read-only.
 * Falls back to plain textareas when Monaco (CDN) fails to load,
 * so Apply/Refresh keep working offline and in jsdom tests.
 */
export function createCodeDock(editor: Editor, opts: CodeDockOptions = {}, deps: CodeDockDeps): CodeDockHandle {
  const side = opts.side ?? 'left';
  const width = opts.width ?? readStoredWidth() ?? DOCK_WIDTH_DEFAULT;
  let currentWidth = width;
  const mountParent = deps.mountTo?.() ?? (editor.getContainer() as HTMLElement | undefined)?.parentElement ?? document.body;
  const editorRoot = (editor.getContainer() as HTMLElement | undefined) ?? null;

  const el = document.createElement('div');
  el.className = 'mjml-code-dock';
  const borderSide = side === 'left' ? 'border-right:1px solid rgba(0,0,0,0.25);' : 'border-left:1px solid rgba(0,0,0,0.25);';
  // $mainColor/$fontColor/$mainFont — same as the GrapesJS panels.
  el.style.cssText = `display:none;position:relative;flex:0 0 ${width}px;flex-direction:column;background:#444;color:#ddd;font-family:Helvetica,sans-serif;font-size:0.75rem;${borderSide}min-width:${DOCK_WIDTH_MIN}px;max-width:80vw;`;

  // Resize grip (right edge for a left dock, left edge for a right dock).
  const grip = document.createElement('div');
  grip.className = 'mjml-code-dock-resize';
  grip.style.cssText = `position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:2;background:rgba(255,255,255,0.06);${side === 'left' ? 'right:-4px;' : 'left:-4px;'}`;
  el.appendChild(grip);

  // Toolbar — same background as the GrapesJS top bar (gjs-one-bg,
  // themed to #2c2e35 by the plugin). Class, not a hex copy, so future
  // theme changes propagate automatically.
  const toolbar = document.createElement('div');
  toolbar.className = 'gjs-one-bg';
  toolbar.style.cssText = 'display:flex;align-items:center;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.25);';
  const mjmlTab = tabButton('MJML ●');
  const htmlTab = tabButton('HTML');
  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex:1;';
  const refreshBtn = toolbarButton('Refresh', 'Reload MJML + HTML from canvas');
  const applyBtn = toolbarButton('Apply', 'Validate MJML and apply to canvas (Ctrl+S)');
  const copyBtn = toolbarButton('Copy', 'Copy HTML to clipboard');
  const formatBtn = toolbarButton('Format', 'Format current tab');
  const colorsBtn = toolbarButton('Colors', 'Toggle tag-pair colors (same tag = same color)');
  const closeBtn = toolbarButton('✕', 'Close code view');
  toolbar.append(mjmlTab, htmlTab, spacer, refreshBtn, applyBtn, copyBtn, formatBtn, colorsBtn, closeBtn);
  el.appendChild(toolbar);

  // Error banner — $colorRed-tinted, like a native validation warning.
  const banner = document.createElement('div');
  banner.style.cssText = 'display:none;background:rgba(221,54,54,0.15);color:#ddd;padding:8px 12px;font-size:12px;white-space:pre-wrap;max-height:120px;overflow:auto;border-bottom:1px solid #dd3636;';
  el.appendChild(banner);

  // Body
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;position:relative;min-height:200px;';
  const monacoMjmlEl = document.createElement('div');
  monacoMjmlEl.style.cssText = 'position:absolute;inset:0;';
  const monacoHtmlEl = document.createElement('div');
  monacoHtmlEl.style.cssText = 'position:absolute;inset:0;display:none;';
  const fallbackMjml = document.createElement('textarea');
  fallbackMjml.setAttribute('aria-label', 'MJML source');
  fallbackMjml.style.cssText = 'position:absolute;inset:0;display:none;width:100%;height:100%;background:#1e1e1e;color:#d4d4d4;border:none;resize:none;font-family:monospace;font-size:12px;padding:8px;box-sizing:border-box;';
  const fallbackHtml = document.createElement('textarea');
  fallbackHtml.setAttribute('aria-label', 'HTML output (read-only)');
  fallbackHtml.readOnly = true;
  fallbackHtml.style.cssText = fallbackMjml.style.cssText + 'display:none;';
  body.append(monacoMjmlEl, monacoHtmlEl, fallbackMjml, fallbackHtml);
  el.appendChild(body);

  // Status bar — same chrome as the toolbar above.
  const status = document.createElement('div');
  status.className = 'gjs-one-bg';
  status.style.cssText = 'padding:4px 10px;font-size:11px;color:#999;border-top:1px solid rgba(0,0,0,0.25);';
  el.appendChild(status);

  let monaco: any = null;
  let mjmlEditor: any = null;
  let htmlEditor: any = null;
  let monacoReady = false;
  let useFallback = false;
  let activeTab: 'mjml' | 'html' = 'mjml';
  let lastApplied = '';
  let open = false;
  let destroyed = false;
  let colorizerEnabled = opts.tagColorizer ?? true;
  let disposeColorizer: (() => void) | null = null;

  const paintColorsBtn = () => {
    colorsBtn.style.opacity = colorizerEnabled ? '1' : '0.5';
    colorsBtn.title = colorizerEnabled
      ? 'Tag-pair colors ON — click to disable (same tag = same color)'
      : 'Tag-pair colors OFF — click to enable (same tag = same color)';
  };

  const applyColorizerState = () => {
    disposeColorizer?.();
    disposeColorizer = null;
    if (colorizerEnabled && monaco && mjmlEditor && monacoReady && !useFallback) {
      try {
        disposeColorizer = enableTagColorizer(monaco, mjmlEditor);
      } catch {
        disposeColorizer = null;
      }
    }
    paintColorsBtn();
  };

  const paintTabs = () => {
    mjmlTab.style.color = activeTab === 'mjml' ? '#fff' : '#999';
    mjmlTab.style.borderBottom = activeTab === 'mjml' ? '2px solid #f45e43' : '2px solid transparent';
    htmlTab.style.color = activeTab === 'html' ? '#fff' : '#999';
    htmlTab.style.borderBottom = activeTab === 'html' ? '2px solid #f45e43' : '2px solid transparent';
    mjmlTab.textContent = `MJML${handle.isDirty() ? ' ●' : ''}`;
    const showMjml = activeTab === 'mjml';
    monacoMjmlEl.style.display = monacoReady && !useFallback && showMjml ? 'block' : 'none';
    monacoHtmlEl.style.display = monacoReady && !useFallback && !showMjml ? 'block' : 'none';
    fallbackMjml.style.display = useFallback && showMjml ? 'block' : 'none';
    fallbackHtml.style.display = useFallback && !showMjml ? 'block' : 'none';
    copyBtn.style.display = showMjml ? 'none' : '';
    applyBtn.style.display = showMjml ? '' : 'none';
  };

  const paintStatus = (errors: any[] = []) => {
    const dirty = handle.isDirty();
    status.textContent = `${dirty ? '● Modified — Apply to update canvas' : 'In sync with canvas'}${errors.length ? ` · ${errors.length} error(s)` : ''}`;
  };

  const showBanner = (errors: any[]) => {
    const lines = errors.slice(0, 5).map((e: any) => e?.formattedMessage ?? String(e));
    banner.textContent = `MJML has errors — Apply blocked:\n${lines.join('\n')}${errors.length > 5 ? `\n… +${errors.length - 5} more` : ''}`;
    banner.style.display = 'block';
  };

  const hideBanner = () => {
    banner.style.display = 'none';
    banner.textContent = '';
  };

  const setMarkers = (errors: any[]) => {
    try {
      if (!monaco || !mjmlEditor) return;
      const model = mjmlEditor.getModel?.();
      if (!model) return;
      const markers = errors
        .filter((e: any) => typeof e?.line === 'number')
        .map((e: any) => ({
          severity: monaco.MarkerSeverity.Error,
          message: e.formattedMessage ?? String(e),
          startLineNumber: e.line,
          startColumn: 1,
          endLineNumber: e.line,
          endColumn: 1000,
        }));
      monaco.editor.setModelMarkers(model, 'mjml', markers);
    } catch {
      // Markers are best-effort in P0; the banner is the source of truth.
    }
  };

  const handle: CodeDockHandle = {
    el,

    isOpen: () => open,

    open: () => {
      if (destroyed || open) return;
      open = true;
      el.style.display = 'flex';
      handle.refresh();
      try {
        mjmlEditor?.layout?.();
        htmlEditor?.layout?.();
      } catch {
        // layout before visible — harmless
      }
    },

    close: () => {
      open = false;
      el.style.display = 'none';
    },

    toggle: () => {
      if (open) handle.close();
      else handle.open();
      return open;
    },

    getMjml: () => {
      if (mjmlEditor) {
        try {
          return mjmlEditor.getValue() ?? '';
        } catch {
          // fall through to textarea
        }
      }
      return fallbackMjml.value;
    },

    setMjml: (value: string) => {
      fallbackMjml.value = value;
      try {
        mjmlEditor?.setValue?.(value);
      } catch {
        // monaco not ready — textarea holds the value until flush
      }
      paintTabs();
      paintStatus();
    },

    isDirty: () => handle.getMjml() !== lastApplied,

    isColorizerEnabled: () => colorizerEnabled,

    setColorizerEnabled: (on: boolean) => {
      colorizerEnabled = !!on;
      applyColorizerState();
    },

    refresh: () => {
      hideBanner();
      const mjml = deps.readMjml();
      // Display pretty-printed MJML — the formatter is idempotent, so
      // dirty-tracking (getMjml() !== lastApplied) stays stable.
      const formatted = formatMjml(mjml);
      lastApplied = formatted;
      handle.setMjml(formatted);
      try {
        const { html, errors } = deps.compileMjml(mjml);
        fallbackHtml.value = html;
        htmlEditor?.setValue?.(html);
        setMarkers([]);
        paintStatus(errors);
      } catch {
        paintStatus();
      }
      paintTabs();
    },

    apply: () => {
      const mjml = handle.getMjml();
      let compiled: { html: string; errors: any[] };
      try {
        compiled = deps.compileMjml(mjml);
      } catch (err) {
        showBanner([err]);
        paintStatus([err]);
        return { applied: false, errors: [err] };
      }
      const blocking = blockingErrors(compiled.errors);
      if (blocking.length) {
        showBanner(blocking);
        setMarkers(blocking);
        paintStatus(blocking);
        paintTabs();
        return { applied: false, errors: blocking };
      }
      deps.writeMjml(mjml);
      lastApplied = mjml;
      hideBanner();
      setMarkers([]);
      fallbackHtml.value = compiled.html;
      try {
        htmlEditor?.setValue?.(compiled.html);
      } catch {
        // html editor not ready — textarea holds the value
      }
      paintStatus([]);
      paintTabs();
      return { applied: true, errors: [] };
    },

    destroy: () => {
      destroyed = true;
      document.removeEventListener('mousemove', onResizeMove);
      try {
        disposeColorizer?.();
      } catch {
        // colorizer already torn down
      }
      disposeColorizer = null;
      try {
        mjmlEditor?.dispose?.();
        htmlEditor?.dispose?.();
      } catch {
        // already disposed
      }
      el.remove();
      if (editorRoot && (editorRoot as HTMLElement).style) {
        (editorRoot as HTMLElement).style.display = '';
        (editorRoot as HTMLElement).style.flex = '';
        (editorRoot as HTMLElement).style.minWidth = '';
      }
      if (parentDisplaySet && editorRoot?.parentElement) {
        (editorRoot.parentElement as HTMLElement).style.display = '';
      }
    },
  };

  // Events
  mjmlTab.onclick = () => {
    activeTab = 'mjml';
    paintTabs();
  };
  htmlTab.onclick = () => {
    activeTab = 'html';
    paintTabs();
  };
  refreshBtn.onclick = () => handle.refresh();
  applyBtn.onclick = () => handle.apply();
  formatBtn.onclick = () => {
    if (activeTab === 'mjml' && !mjmlEditor) {
      // Fallback path (or Monaco still loading): format the textarea directly.
      handle.setMjml(formatMjml(handle.getMjml()));
      return;
    }
    try {
      (activeTab === 'mjml' ? mjmlEditor : htmlEditor)?.getAction?.('editor.action.formatDocument')?.run?.();
    } catch {
      // no formatter — harmless
    }
  };
  copyBtn.onclick = () => {
    const html = (() => {
      try {
        return htmlEditor?.getValue?.() ?? fallbackHtml.value;
      } catch {
        return fallbackHtml.value;
      }
    })();
    try {
      navigator.clipboard?.writeText?.(html);
      status.textContent = 'HTML copied to clipboard';
    } catch {
      fallbackHtml.select?.();
      try {
        document.execCommand('copy');
      } catch {
        // clipboard unavailable
      }
    }
  };
  closeBtn.onclick = () => handle.close();
  colorsBtn.onclick = () => {
    colorizerEnabled = !colorizerEnabled;
    applyColorizerState();
  };
  fallbackMjml.oninput = () => {
    paintTabs();
    paintStatus();
  };

  // Drag-to-resize. A left dock grows dragging right, a right dock dragging left.
  const resizeDir = side === 'left' ? 1 : -1;
  let dragStartX = 0;
  let dragStartW = 0;
  const onResizeMove = (ev: MouseEvent) => {
    const max = Math.floor((globalThis.innerWidth || 1600) * 0.8);
    currentWidth = Math.min(Math.max(dragStartW + resizeDir * (ev.clientX - dragStartX), DOCK_WIDTH_MIN), max);
    el.style.flex = `0 0 ${Math.round(currentWidth)}px`;
  };
  const onResizeUp = () => {
    document.removeEventListener('mousemove', onResizeMove);
    storeWidth(currentWidth);
  };
  grip.addEventListener('mousedown', (ev: MouseEvent) => {
    dragStartX = ev.clientX;
    dragStartW = currentWidth;
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeUp, { once: true });
    ev.preventDefault();
  });

  // Mount as a true flex split. Left dock goes before the editor root.
  let parentDisplaySet = false;
  try {
    if (!deps.mountTo && editorRoot && mountParent === editorRoot.parentElement) {
      (editorRoot as HTMLElement).style.flex = '1';
      (editorRoot as HTMLElement).style.minWidth = '0';
      const parent = editorRoot.parentElement as HTMLElement;
      if (parent && !parent.style.display) {
        parent.style.display = 'flex';
        parentDisplaySet = true;
      }
      mountParent.insertBefore(el, side === 'left' ? editorRoot : null);
    } else if (side === 'left') {
      mountParent.insertBefore(el, mountParent.firstChild);
    } else {
      mountParent.appendChild(el);
    }
  } catch {
    document.body.appendChild(el);
  }

  // Async Monaco init — textarea fallback stays authoritative until ready.
  deps
    .loadMonaco()
    .then((m: any) => {
      if (destroyed) return;
      monaco = m;
      try {
        registerMjmlLanguage(monaco);
        mjmlEditor = monaco.editor.create(monacoMjmlEl, {
          value: fallbackMjml.value,
          language: 'mjml',
          theme: 'vs-dark',
          tabSize: 2,
          insertSpaces: true,
          autoIndent: 'full',
          trimAutoWhitespace: true,
          automaticLayout: true,
          minimap: { enabled: false },
          wordWrap: 'on',
        });
        htmlEditor = monaco.editor.create(monacoHtmlEl, {
          value: fallbackHtml.value,
          language: 'html',
          theme: 'vs-dark',
          readOnly: true,
          automaticLayout: true,
          minimap: { enabled: false },
          wordWrap: 'on',
        });
        mjmlEditor.onDidChangeModelContent?.(() => {
          paintTabs();
          paintStatus();
        });
        monacoReady = true;
        useFallback = false;
        applyColorizerState();
      } catch {
        useFallback = true;
      }
      paintTabs();
    })
    .catch(() => {
      // Offline/CDN failure — plain textareas keep Apply/Refresh working.
      useFallback = true;
      paintColorsBtn();
      paintTabs();
    });

  // Until Monaco resolves, fallbacks are visible so the dock is usable
  // from the first paint (and stay if the CDN load fails).
  useFallback = true;
  paintTabs();
  paintColorsBtn();
  paintStatus();

  return handle;
}
