import type { Editor } from 'grapesjs';
import { attachSplitter } from '../ui/splitter';
import { ensureUiStyles } from '../ui/styles';
import { formatMjml, registerMjmlLanguage } from './mjmlLanguage';
import { enableTagColorizer } from './tagColorizer';
import { blockingErrors } from './validate';

export interface CodeDockLayoutState {
  open: boolean;
  width: number;
  side: 'left' | 'right';
}

export interface CodeDockDeps {
  loadMonaco: () => Promise<any>;
  /** MJML source of truth from the canvas (cmdGetMjml). */
  readMjml: () => string;
  /** Compile MJML (mjmlConvert). Used for the HTML tab + Apply validation. */
  compileMjml: (mjml: string) => { html: string; errors: any[] };
  /** Write MJML back to the canvas (setComponents path). */
  writeMjml: (mjml: string) => void;
  /** Where to append the dock. Defaults to the `.gjs-editor` element. */
  mountTo?: () => HTMLElement | null;
  /**
   * The dock opened, closed or was resized. Return the width actually
   * granted (the layout may clamp it so the canvas keeps its minimum).
   */
  onLayout?: (state: CodeDockLayoutState) => number | void;
  /** Largest width the dock may take right now. */
  maxWidth?: () => number;
  /** ✕ clicked. Should stop the dock command (keeps the toolbar button in sync). */
  onCloseRequest?: () => void;
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

export interface ApplyResult {
  applied: boolean;
  errors: any[];
  /** Apply was refused because the canvas changed under unsaved edits. */
  conflict?: boolean;
}

export interface CodeDockHandle {
  el: HTMLElement;
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => boolean;
  refresh: () => void;
  /** Validate and write to the canvas. `force` overwrites a canvas that changed meanwhile. */
  apply: (opts?: { force?: boolean }) => ApplyResult;
  isDirty: () => boolean;
  /** Canvas changed while the dock held unsaved edits. */
  hasConflict: () => boolean;
  /** Tell the dock the canvas may have changed (debounced by the caller). */
  notifyCanvasChanged: () => void;
  getMjml: () => string;
  setMjml: (value: string) => void;
  getWidth: () => number;
  setWidth: (px: number) => number;
  isColorizerEnabled: () => boolean;
  setColorizerEnabled: (on: boolean) => void;
  destroy: () => void;
}

export const DOCK_WIDTH_DEFAULT = 480;
export const DOCK_WIDTH_MIN = 280;
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

function storeWidth(width: number | null) {
  try {
    if (width === null) globalThis.localStorage?.removeItem(DOCK_WIDTH_KEY);
    else globalThis.localStorage?.setItem(DOCK_WIDTH_KEY, String(Math.round(width)));
  } catch {
    // storage unavailable (private mode, SSR) — width stays in memory
  }
}

// Material Design icon paths (same family as the top-bar icons).
const ICONS = {
  refresh:
    'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z',
  format: 'M3,3H21V5H3V3M7,7H17V9H7V7M3,11H21V13H3V11M7,15H17V17H7V15M3,19H21V21H3V19Z',
  colors:
    'M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z',
  copy: 'M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z',
  close:
    'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
};

function iconButton(icon: keyof typeof ICONS, title: string) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `mjml-dock-icon mjml-dock-${icon}`;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[icon]}"/></svg>`;
  return btn;
}

function tabButton(label: string) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mjml-dock-tab';
  btn.textContent = label;
  return btn;
}

function div(className: string) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

const isMac = () => /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');

/**
 * Docked Monaco code view.
 * MJML tab is editable + Apply-gated; HTML tab is read-only.
 * Falls back to plain textareas when Monaco (CDN) fails to load,
 * so Apply/Refresh keep working offline and in jsdom tests.
 */
export function createCodeDock(editor: Editor, opts: CodeDockOptions = {}, deps: CodeDockDeps): CodeDockHandle {
  ensureUiStyles();
  const side = opts.side ?? 'left';
  let currentWidth = opts.width ?? readStoredWidth() ?? DOCK_WIDTH_DEFAULT;
  const mountParent =
    deps.mountTo?.() ??
    ((editor as any).getEl?.() as HTMLElement | undefined) ??
    (editor.getContainer() as HTMLElement | undefined) ??
    document.body;

  // Chrome — gjs-one-bg/gjs-two-color are the themed GrapesJS panel classes,
  // so the dock follows the editor theme automatically.
  const el = div(`mjml-code-dock mjml-code-dock--${side} gjs-one-bg gjs-two-color`);

  const grip = div('mjml-code-dock-resize');
  el.appendChild(grip);

  const toolbar = div('mjml-dock-bar gjs-one-bg');
  const mjmlTab = tabButton('MJML');
  const htmlTab = tabButton('HTML');
  const refreshBtn = iconButton('refresh', 'Reload from canvas');
  const formatBtn = iconButton('format', 'Format document');
  const colorsBtn = iconButton('colors', 'Tag-pair colors');
  const copyBtn = iconButton('copy', 'Copy HTML to clipboard');
  const closeBtn = iconButton('close', `Close code view (${isMac() ? '⌘' : 'Ctrl'}+\`)`);
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'gjs-btn-prim mjml-dock-apply';
  applyBtn.textContent = 'Apply';
  applyBtn.title = `Validate MJML and apply to canvas (${isMac() ? '⌘' : 'Ctrl'}+S)`;
  toolbar.append(mjmlTab, htmlTab, div('mjml-dock-spacer'), refreshBtn, formatBtn, colorsBtn, copyBtn, applyBtn, div('mjml-dock-sep'), closeBtn);
  el.appendChild(toolbar);

  // Validation errors — $colorRed-tinted, like a native validation warning.
  const banner = div('mjml-dock-banner mjml-dock-banner--error');
  el.appendChild(banner);

  // Canvas changed while the editor holds unsaved edits.
  const conflictBar = div('mjml-dock-banner mjml-dock-banner--warn');
  const conflictText = document.createElement('span');
  conflictText.textContent = 'The canvas changed since you started editing.';
  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'gjs-btn-prim';
  reloadBtn.textContent = 'Reload';
  reloadBtn.title = 'Discard your code edits and load the canvas';
  const overwriteBtn = document.createElement('button');
  overwriteBtn.type = 'button';
  overwriteBtn.className = 'gjs-btn-prim';
  overwriteBtn.textContent = 'Overwrite canvas';
  overwriteBtn.title = 'Apply your code, replacing the canvas changes';
  conflictBar.append(conflictText, reloadBtn, overwriteBtn);
  el.appendChild(conflictBar);

  const body = div('mjml-dock-body');
  const monacoMjmlEl = div('mjml-dock-monaco');
  const monacoHtmlEl = div('mjml-dock-monaco');
  const fallbackMjml = document.createElement('textarea');
  fallbackMjml.setAttribute('aria-label', 'MJML source');
  fallbackMjml.spellcheck = false;
  const fallbackHtml = document.createElement('textarea');
  fallbackHtml.setAttribute('aria-label', 'HTML output (read-only)');
  fallbackHtml.readOnly = true;
  body.append(monacoMjmlEl, monacoHtmlEl, fallbackMjml, fallbackHtml);
  el.appendChild(body);

  const status = div('mjml-dock-status gjs-one-bg');
  const statusText = document.createElement('span');
  statusText.style.flex = '1';
  const statusHint = document.createElement('span');
  status.append(statusText, statusHint);
  el.appendChild(status);

  let monaco: any = null;
  let mjmlEditor: any = null;
  let htmlEditor: any = null;
  let monacoReady = false;
  let useFallback = false;
  let activeTab: 'mjml' | 'html' = 'mjml';
  let lastApplied = '';
  /** Formatted canvas MJML at the last refresh/apply — detects real canvas edits. */
  let canvasSnapshot = '';
  let conflict = false;
  let open = false;
  let destroyed = false;
  let colorizerEnabled = opts.tagColorizer ?? true;
  let disposeColorizer: (() => void) | null = null;

  const toggleOn = (node: HTMLElement, on: boolean) => node.classList[on ? 'add' : 'remove']('is-on');

  const paintColorsBtn = () => {
    toggleOn(colorsBtn, colorizerEnabled);
    colorsBtn.title = `Tag-pair colors: ${colorizerEnabled ? 'on' : 'off'} (same tag = same color)`;
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
    const showMjml = activeTab === 'mjml';
    const dirty = handle.isDirty();
    mjmlTab.classList[showMjml ? 'add' : 'remove']('is-active');
    htmlTab.classList[showMjml ? 'remove' : 'add']('is-active');
    mjmlTab.textContent = `MJML${dirty ? ' ●' : ''}`;
    toggleOn(monacoMjmlEl, monacoReady && !useFallback && showMjml);
    toggleOn(monacoHtmlEl, monacoReady && !useFallback && !showMjml);
    toggleOn(fallbackMjml, useFallback && showMjml);
    toggleOn(fallbackHtml, useFallback && !showMjml);
    copyBtn.hidden = showMjml;
    colorsBtn.hidden = !showMjml;
    applyBtn.hidden = !showMjml;
    applyBtn.disabled = !dirty;
  };

  const paintStatus = (errors: any[] = []) => {
    const dirty = handle.isDirty();
    statusText.textContent = `${dirty ? '● Modified' : 'In sync with canvas'}${errors.length ? ` · ${errors.length} error(s)` : ''}`;
    statusText.className = dirty ? 'is-dirty' : '';
    statusHint.textContent = dirty && activeTab === 'mjml' ? `${isMac() ? '⌘' : 'Ctrl'}+S to apply` : '';
  };

  const showBanner = (errors: any[]) => {
    const lines = errors.slice(0, 5).map((e: any) => e?.formattedMessage ?? String(e));
    banner.textContent = `MJML has errors — Apply blocked:\n${lines.join('\n')}${errors.length > 5 ? `\n… +${errors.length - 5} more` : ''}`;
    toggleOn(banner, true);
  };

  const hideBanner = () => {
    toggleOn(banner, false);
    banner.textContent = '';
  };

  const setConflict = (on: boolean) => {
    conflict = on;
    toggleOn(conflictBar, on);
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
      // Markers are best-effort; the banner is the source of truth.
    }
  };

  const clampWidth = (px: number) => {
    const max = deps.maxWidth?.() ?? Math.floor((globalThis.innerWidth || 1600) * 0.8);
    return Math.round(Math.max(DOCK_WIDTH_MIN, Math.min(px, Math.max(max, DOCK_WIDTH_MIN))));
  };

  /** Size the dock and tell the layout. */
  const layoutDock = () => {
    if (!open) {
      deps.onLayout?.({ open: false, width: 0, side });
      return;
    }
    const wanted = clampWidth(currentWidth);
    const granted = deps.onLayout?.({ open: true, width: wanted, side });
    currentWidth = typeof granted === 'number' && granted > 0 ? granted : wanted;
    el.style.width = `${currentWidth}px`;
  };

  const setEditorValue = (ed: any, value: string) => {
    if (!ed) return;
    try {
      // Keep cursor + scroll when content is swapped under the user.
      const view = ed.saveViewState?.();
      ed.setValue?.(value);
      view && ed.restoreViewState?.(view);
    } catch {
      // editor not ready — textarea holds the value
    }
  };

  const handle: CodeDockHandle = {
    el,

    isOpen: () => open,

    open: () => {
      if (destroyed || open) return;
      open = true;
      el.classList.add('is-open');
      layoutDock();
      handle.refresh();
      try {
        mjmlEditor?.layout?.();
        htmlEditor?.layout?.();
        (activeTab === 'mjml' ? mjmlEditor : htmlEditor)?.focus?.();
      } catch {
        // layout before visible — harmless
      }
    },

    close: () => {
      if (!open) return;
      open = false;
      el.classList.remove('is-open');
      layoutDock();
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
      setEditorValue(mjmlEditor, value);
      paintTabs();
      paintStatus();
    },

    isDirty: () => handle.getMjml() !== lastApplied,

    hasConflict: () => conflict,

    getWidth: () => currentWidth,

    setWidth: (px: number) => {
      currentWidth = clampWidth(px);
      layoutDock();
      return currentWidth;
    },

    isColorizerEnabled: () => colorizerEnabled,

    setColorizerEnabled: (on: boolean) => {
      colorizerEnabled = !!on;
      applyColorizerState();
    },

    refresh: () => {
      hideBanner();
      setConflict(false);
      const mjml = deps.readMjml();
      // Display pretty-printed MJML — the formatter is idempotent, so
      // dirty-tracking (getMjml() !== lastApplied) stays stable.
      const formatted = formatMjml(mjml);
      lastApplied = formatted;
      canvasSnapshot = formatted;
      handle.setMjml(formatted);
      try {
        const { html, errors } = deps.compileMjml(mjml);
        fallbackHtml.value = html;
        setEditorValue(htmlEditor, html);
        setMarkers([]);
        paintStatus(errors);
      } catch {
        paintStatus();
      }
      paintTabs();
    },

    notifyCanvasChanged: () => {
      // Closed: open() always reloads, nothing to track.
      if (!open || destroyed) return;
      let current: string;
      try {
        current = formatMjml(deps.readMjml());
      } catch {
        return;
      }
      if (current === canvasSnapshot) return; // our own apply, or no content change
      if (handle.isDirty()) setConflict(true);
      else handle.refresh();
    },

    apply: ({ force = false } = {}) => {
      if (conflict && !force) {
        setConflict(true);
        return { applied: false, errors: [], conflict: true };
      }
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
      try {
        canvasSnapshot = formatMjml(deps.readMjml());
      } catch {
        canvasSnapshot = formatMjml(mjml);
      }
      setConflict(false);
      hideBanner();
      setMarkers([]);
      fallbackHtml.value = compiled.html;
      setEditorValue(htmlEditor, compiled.html);
      paintStatus([]);
      paintTabs();
      return { applied: true, errors: [] };
    },

    destroy: () => {
      destroyed = true;
      detachGrip();
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
      if (open) {
        open = false;
        layoutDock();
      }
      el.remove();
    },
  };

  // Events
  mjmlTab.onclick = () => {
    activeTab = 'mjml';
    paintTabs();
    paintStatus();
  };
  htmlTab.onclick = () => {
    activeTab = 'html';
    paintTabs();
    paintStatus();
  };
  refreshBtn.onclick = () => {
    if (handle.isDirty() && !conflict && !globalThis.confirm?.('Discard your code edits and reload from the canvas?')) return;
    handle.refresh();
  };
  applyBtn.onclick = () => handle.apply();
  reloadBtn.onclick = () => handle.refresh();
  overwriteBtn.onclick = () => handle.apply({ force: true });
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
    const done = () => (statusText.textContent = 'HTML copied to clipboard');
    try {
      const p = navigator.clipboard?.writeText?.(html);
      if (p) p.then(done, () => (statusText.textContent = 'Copy failed — select the HTML and copy manually'));
      else throw new Error('no clipboard');
    } catch {
      fallbackHtml.select?.();
      try {
        document.execCommand('copy');
        done();
      } catch {
        // clipboard unavailable
      }
    }
  };
  closeBtn.onclick = () => (deps.onCloseRequest ? deps.onCloseRequest() : handle.close());
  colorsBtn.onclick = () => {
    colorizerEnabled = !colorizerEnabled;
    applyColorizerState();
  };
  fallbackMjml.oninput = () => {
    paintTabs();
    paintStatus();
  };
  // Ctrl/⌘+S applies — only while focus is in the dock (Monaco binds its own, below).
  fallbackMjml.addEventListener('keydown', (ev: KeyboardEvent) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      handle.isDirty() && handle.apply();
    }
  });

  // Drag-to-resize. A left dock grows dragging right, a right dock dragging left.
  const resizeDir = side === 'left' ? 1 : -1;
  let dragStartW = 0;
  const detachGrip = attachSplitter(
    grip,
    {
      onStart: () => {
        dragStartW = currentWidth;
      },
      onMove: (dx) => {
        handle.setWidth(dragStartW + resizeDir * dx);
      },
      onEnd: () => storeWidth(currentWidth),
      onReset: () => {
        handle.setWidth(DOCK_WIDTH_DEFAULT);
        storeWidth(null);
      },
    },
    { label: 'Resize code view' },
  );

  if (side === 'left') mountParent.insertBefore(el, mountParent.firstChild);
  else mountParent.appendChild(el);

  // Async Monaco init — textarea fallback stays authoritative until ready.
  deps
    .loadMonaco()
    .then((m: any) => {
      if (destroyed) return;
      monaco = m;
      try {
        registerMjmlLanguage(monaco);
        // Read before the Monaco editor exists: getMjml() prefers it.
        const initialMjml = fallbackMjml.value;
        mjmlEditor = monaco.editor.create(monacoMjmlEl, {
          value: initialMjml,
          language: 'mjml',
          theme: 'vs-dark',
          tabSize: 2,
          insertSpaces: true,
          autoIndent: 'full',
          trimAutoWhitespace: true,
          automaticLayout: true,
          minimap: { enabled: false },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
        });
        htmlEditor = monaco.editor.create(monacoHtmlEl, {
          value: fallbackHtml.value,
          language: 'html',
          theme: 'vs-dark',
          readOnly: true,
          automaticLayout: true,
          minimap: { enabled: false },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
        });
        mjmlEditor.onDidChangeModelContent?.(() => {
          paintTabs();
          paintStatus();
        });
        // Ctrl/⌘+S inside the editor: apply (and never the browser's Save page).
        mjmlEditor.addCommand?.(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          handle.isDirty() && handle.apply();
        });
        // Ctrl/⌘+` inside the editor closes the dock (same key that opens it).
        mjmlEditor.addCommand?.(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => closeBtn.click());
        htmlEditor.addCommand?.(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => closeBtn.click());
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
