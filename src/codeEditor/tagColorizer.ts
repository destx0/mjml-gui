/**
 * Tag-pair colorizer for the MJML code dock.
 *
 * Goal: the same tag name always gets the same highlighted color, so a
 * matching `<mj-section> … </mj-section>` pair is instantly recognizable.
 * Different tag names cycle through a fixed high-contrast palette
 * (dark-theme friendly).
 *
 * Two layers:
 *  1. Per-tag-name colors via Monaco `deltaDecorations` / decorations
 *     collections (Monarch tokens can't vary by tag name).
 *  2. Active-pair highlight: when the cursor sits on (or inside) a tag,
 *     its matching open/close partner gets a background wash.
 *
 * Pure helpers (`colorIndexForTag`, `parseTagTokens`, `matchTagPairs`)
 * are Monaco-free so they stay unit-testable in jsdom.
 */

export const TAG_COLOR_PALETTE = [
  '#4ec9b0', // teal
  '#c586c0', // purple
  '#dcdcaa', // yellow
  '#9cdcfe', // light blue
  '#ce9178', // orange/salmon
  '#b5cea8', // green
  '#d16969', // red
  '#6796e6', // blue
  '#f78c6c', // coral
  '#c3e88d', // lime
  '#89ddff', // cyan
  '#f07178', // pink-red
] as const;

export const TAG_COLOR_CSS_PREFIX = 'mjml-tag-color-';
export const TAG_PAIR_ACTIVE_CLASS = 'mjml-tag-pair-active';

export interface TagToken {
  /** Lower-cased tag name, e.g. `mj-section`. */
  tagName: string;
  /** Offset (0-based) of the first char of the tag *name* (not `<`). */
  startOffset: number;
  /** Offset just past the last char of the tag name. */
  endOffset: number;
  /** True for `</…>`, false for `<…>` / `<…/>`. */
  isClose: boolean;
  /** True for `<…/>` (or known void tags without a closer). */
  isSelfClosing: boolean;
}

export interface TagPair {
  openIndex: number;
  closeIndex: number;
}

/**
 * Deterministic palette slot for a tag name. Case-insensitive so
 * `<MJ-TEXT>` and `<mj-text>` share a color.
 */
export function colorIndexForTag(tagName: string, paletteSize: number = TAG_COLOR_PALETTE.length): number {
  const name = tagName.toLowerCase();
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % paletteSize;
}

export function colorForTag(tagName: string, palette: readonly string[] = TAG_COLOR_PALETTE): string {
  if (!palette.length) return '#ffffff';
  return palette[colorIndexForTag(tagName, palette.length)];
}

/** Blank out ranges (comments) with spaces so offsets stay stable. */
function blankComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
}

/**
 * Find every tag-name occurrence in `src`. Returns tokens ordered by
 * appearance with stable 0-based offsets into the original string.
 * Comment contents are ignored. Inner CSS of `<mj-style>` is ignored
 * automatically (it contains no `<tag>` sequences).
 */
export function parseTagTokens(src: string): TagToken[] {
  const clean = blankComments(src);
  const tokens: TagToken[] = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)[^<>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const isClose = m[1] === '/';
    const rawName = m[2];
    const tagName = rawName.toLowerCase();
    // `<mj-style>` CSS hatch: never treat stray `<` inside styleContent as tags.
    // Our regex already requires `>` on the same run, so CSS rules are safe.
    const nameIndexInMatch = m[0].indexOf(rawName);
    const startOffset = m.index + nameIndexInMatch;
    const endOffset = startOffset + rawName.length;
    const isSelfClosing = !isClose && m[3] === '/';
    tokens.push({ tagName, startOffset, endOffset, isClose, isSelfClosing });
  }
  return tokens;
}

/**
 * Match open/close tokens into pairs (stack-based, per tag name).
 * Self-closing and void tags never pair. Unmatched closers are ignored.
 */
export function matchTagPairs(tokens: TagToken[]): TagPair[] {
  const pairs: TagPair[] = [];
  const stack: number[] = [];
  tokens.forEach((tok, idx) => {
    if (tok.isSelfClosing) return;
    if (!tok.isClose) {
      stack.push(idx);
      return;
    }
    // Find the nearest open with the same name (tolerates minor mismatches).
    for (let s = stack.length - 1; s >= 0; s -= 1) {
      if (tokens[stack[s]].tagName === tok.tagName) {
        const openIndex = stack.splice(s, 1)[0];
        pairs.push({ openIndex, closeIndex: idx });
        break;
      }
    }
  });
  return pairs;
}

/**
 * Given an offset, find the token index containing it (or the closest tag
 * name just before it). Returns -1 when far from any tag name.
 */
export function tokenIndexAtOffset(tokens: TagToken[], offset: number): number {
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (offset >= t.startOffset && offset <= t.endOffset) return i;
  }
  return -1;
}

/** Find the pair containing `tokenIndex`, if any. */
export function pairForToken(pairs: TagPair[], tokenIndex: number): TagPair | null {
  for (const p of pairs) {
    if (p.openIndex === tokenIndex || p.closeIndex === tokenIndex) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Monaco wiring
// ---------------------------------------------------------------------------

export interface TagColorizerOptions {
  palette?: readonly string[];
  /** Extra background wash for the active pair. */
  pairHighlight?: string;
}

const STYLE_ELEMENT_ID = 'mjml-tag-colorizer-style';

function ensureStyleElement(palette: readonly string[], pairHighlight: string): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    document.head.appendChild(style);
  }
  const rules = palette.map(
    (color, i) =>
      `.${TAG_COLOR_CSS_PREFIX}${i} { color: ${color} !important; font-weight: 600; }`,
  );
  rules.push(
    `.${TAG_PAIR_ACTIVE_CLASS} { background: ${pairHighlight}; border-radius: 3px; }`,
  );
  style.textContent = rules.join('\n');
}

/**
 * Attach the colorizer to a Monaco editor instance. Returns a dispose
 * callback. Safe to call when `monaco` is a stub (no-ops without models).
 */
export function enableTagColorizer(
  monaco: any,
  mjmlEditor: any,
  opts: TagColorizerOptions = {},
): () => void {
  const palette = opts.palette ?? TAG_COLOR_PALETTE;
  const pairHighlight = opts.pairHighlight ?? 'rgba(244, 94, 67, 0.28)';
  ensureStyleElement(palette, pairHighlight);

  const model = (() => {
    try {
      return mjmlEditor?.getModel?.();
    } catch {
      return null;
    }
  })();
  if (!model || typeof mjmlEditor?.deltaDecorations !== 'function') {
    return () => {};
  }

  let colorIds: string[] = [];
  let pairIds: string[] = [];
  let disposed = false;
  let scheduled = false;

  const paintAll = () => {
    if (disposed) return;
    let text = '';
    try {
      text = model.getValue() ?? '';
    } catch {
      return;
    }
    const tokens = parseTagTokens(text);
    try {
      const toRange = (t: TagToken) => {
        const start = model.getPositionAt(t.startOffset);
        const end = model.getPositionAt(t.endOffset);
        return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
      };
      colorIds = mjmlEditor.deltaDecorations(
        colorIds,
        tokens.map((t) => ({
          range: toRange(t),
          options: {
            inlineClassName: `${TAG_COLOR_CSS_PREFIX}${colorIndexForTag(t.tagName, palette.length)}`,
            stickiness: monaco.editor?.TrackedRangeStickiness?.NeverGrowsWhenTypingAtEdges,
          },
        })),
      );
    } catch {
      // decorations are best-effort; editing must never break
    }
    paintPair(tokens);
  };

  const paintPair = (tokens?: TagToken[]) => {
    if (disposed) return;
    try {
      const list = tokens ?? parseTagTokens(model.getValue() ?? '');
      const pos = mjmlEditor.getPosition?.();
      if (!pos) {
        pairIds = mjmlEditor.deltaDecorations(pairIds, []);
        return;
      }
      const offset = model.getOffsetAt(pos);
      const idx = tokenIndexAtOffset(list, offset);
      if (idx === -1) {
        pairIds = mjmlEditor.deltaDecorations(pairIds, []);
        return;
      }
      const pairs = matchTagPairs(list);
      const pair = pairForToken(pairs, idx);
      if (!pair) {
        pairIds = mjmlEditor.deltaDecorations(pairIds, []);
        return;
      }
      const toRange = (t: TagToken) => {
        const start = model.getPositionAt(t.startOffset);
        const end = model.getPositionAt(t.endOffset);
        return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
      };
      pairIds = mjmlEditor.deltaDecorations(pairIds, [
        { range: toRange(list[pair.openIndex]), options: { inlineClassName: TAG_PAIR_ACTIVE_CLASS } },
        { range: toRange(list[pair.closeIndex]), options: { inlineClassName: TAG_PAIR_ACTIVE_CLASS } },
      ]);
    } catch {
      // ignore
    }
  };

  const schedule = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      paintAll();
    };
    // requestAnimationFrame keeps typing smooth; fallback to microtask in jsdom.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  };

  const disposables: Array<{ dispose?: () => void }> = [];
  try {
    disposables.push(mjmlEditor.onDidChangeModelContent?.(() => schedule()));
    disposables.push(mjmlEditor.onDidChangeCursorPosition?.(() => paintPair()));
  } catch {
    // event hooks optional
  }

  paintAll();

  return () => {
    disposed = true;
    try {
      mjmlEditor.deltaDecorations(colorIds, []);
      mjmlEditor.deltaDecorations(pairIds, []);
    } catch {
      // ignore
    }
    disposables.forEach((d) => {
      try {
        d?.dispose?.();
      } catch {
        // ignore
      }
    });
  };
}
