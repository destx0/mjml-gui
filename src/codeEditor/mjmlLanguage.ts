/**
 * Monaco `mjml` language: Monarch highlighting, indentation rules,
 * tag completions and a document formatter.
 *
 * P0 used Monaco's `html` mode, which mis-indents MJML (void tags like
 * `<mj-image>` were treated as unclosed containers). This registers a
 * dedicated language so highlighting + Enter-indentation + Format are
 * MJML-aware.
 */

export interface MjmlTag {
  name: string;
  doc: string;
}

export const MJML_TAGS: MjmlTag[] = [
  { name: 'mjml', doc: 'MJML root element' },
  { name: 'mj-head', doc: 'Email head (fonts, styles, attributes)' },
  { name: 'mj-title', doc: 'Email title' },
  { name: 'mj-font', doc: 'Custom font import' },
  { name: 'mj-style', doc: 'Custom CSS styles' },
  { name: 'mj-attributes', doc: 'Default attributes for components' },
  { name: 'mj-all', doc: 'Default attributes for all components' },
  { name: 'mj-class', doc: 'Reusable attribute set (mj-class)' },
  { name: 'mj-body', doc: 'Email body' },
  { name: 'mj-section', doc: 'Layout section (row)' },
  { name: 'mj-column', doc: 'Layout column' },
  { name: 'mj-group', doc: 'Group of columns' },
  { name: 'mj-text', doc: 'Text block' },
  { name: 'mj-image', doc: 'Image (void element)' },
  { name: 'mj-button', doc: 'Button' },
  { name: 'mj-divider', doc: 'Horizontal divider (void element)' },
  { name: 'mj-spacer', doc: 'Vertical spacing (void element)' },
  { name: 'mj-social', doc: 'Social icons group' },
  { name: 'mj-social-element', doc: 'Single social icon' },
  { name: 'mj-navbar', doc: 'Navigation bar' },
  { name: 'mj-navbar-link', doc: 'Navigation link' },
  { name: 'mj-hero', doc: 'Hero section with background' },
  { name: 'mj-wrapper', doc: 'Full-width wrapper' },
  { name: 'mj-raw', doc: 'Raw HTML passthrough' },
];

/** Tags that never have children — no indentation level is opened. */
export const MJML_VOID_TAGS = new Set([
  'mj-image',
  'mj-divider',
  'mj-spacer',
  'mj-social-element',
  'mj-font',
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Tags whose inner content is kept verbatim (not re-indented). */
const MJML_RAW_TAGS = new Set(['mj-style']);

const registered = new WeakSet<object>();

function tagNameOf(rawTag: string): string {
  return rawTag
    .replace(/[<>/]/g, '')
    .trim()
    .split(/\s+/, 1)[0]
    .toLowerCase();
}

/**
 * Pretty-print MJML: one tag per line, 2-space nesting, short
 * `<tag>text</tag>` runs kept on a single line, `mj-style` CSS kept
 * verbatim. Idempotent — formatting twice yields the same output.
 */
export function formatMjml(src: string, indentUnit = '  '): string {
  const pad = (depth: number) => indentUnit.repeat(Math.max(0, depth));
  const lines: string[] = [];
  const re = /(<!--[\s\S]*?-->)|(<\/[a-zA-Z][^<>]*>)|(<[a-zA-Z][^<>]*\/>)|(<[a-zA-Z][^<>]*>)|([^<>]+)/g;
  let m: RegExpExecArray | null;
  let depth = 0;

  const pushOpen = (raw: string, name: string) => {
    lines.push(`${pad(depth)}${raw}`);
    depth += 1;
    void name;
  };

  while ((m = re.exec(src))) {
    if (m[1]) {
      // Comment (may span lines — keep each line, trimmed of trailing space).
      m[1]
        .split('\n')
        .map((l) => l.replace(/\s+$/, ''))
        .filter((l) => l.trim())
        .forEach((l) => lines.push(`${pad(depth)}${l.trim()}`));
    } else if (m[2]) {
      depth = Math.max(0, depth - 1);
      lines.push(`${pad(depth)}${m[2].trim()}`);
    } else if (m[3]) {
      lines.push(`${pad(depth)}${m[3].trim()}`);
    } else if (m[4]) {
      const raw = m[4].trim();
      const name = tagNameOf(raw);
      if (MJML_VOID_TAGS.has(name)) {
        lines.push(`${pad(depth)}${raw}`);
      } else if (MJML_RAW_TAGS.has(name)) {
        // Keep inner content verbatim until the matching close tag.
        lines.push(`${pad(depth)}${raw}`);
        depth += 1;
        const closeRe = new RegExp(`</${name}\\s*>`, 'i');
        const rest = src.slice(re.lastIndex);
        const found = closeRe.exec(rest);
        const inner = found ? rest.slice(0, found.index) : rest;
        inner
          .split('\n')
          .map((l) => l.replace(/\s+$/, ''))
          .filter((l) => l.trim())
          .forEach((l) => lines.push(`${pad(depth)}${l.trim()}`));
        if (found) {
          depth = Math.max(0, depth - 1);
          lines.push(`${pad(depth)}${found[0].trim()}`);
          re.lastIndex += found.index + found[0].length;
        }
      } else {
        pushOpen(raw, name);
      }
    } else if (m[5]) {
      const text = m[5].replace(/\s+/g, ' ').trim();
      if (text) lines.push(`${pad(depth)}${text}`);
    }
  }

  // Merge short `<tag>text</tag>` (and `<tag></tag>`) runs onto one line.
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i].match(/^( *)<([a-zA-Z][\w-]*)(\s[^<>]*)?>$/);
    const next = lines[i + 1];
    const after = lines[i + 2];
    if (open && next !== undefined) {
      const textOnly = next.match(/^ *([^<>]+)$/);
      const closeMatch = (after ?? next).match(/^ *<\/([a-zA-Z][\w-]*)>$/);
      const closeIdx = textOnly && after !== undefined ? i + 2 : i + 1;
      const closeLine = textOnly ? after : next;
      const close = closeLine?.match(/^ *<\/([a-zA-Z][\w-]*)>$/);
      if (close && close[1].toLowerCase() === open[2].toLowerCase()) {
        const inner = textOnly ? textOnly[1] : '';
        merged.push(`${open[1]}<${open[2]}${open[3] ?? ''}>${inner}</${close[1]}>`);
        i = closeIdx;
        continue;
      }
      void closeMatch;
    }
    merged.push(lines[i]);
  }

  return merged.join('\n');
}

/**
 * Register the `mjml` language with a Monaco instance. Safe to call
 * multiple times per instance (subsequent calls are no-ops).
 */
export function registerMjmlLanguage(monaco: any) {
  if (registered.has(monaco)) return;
  const L = monaco.languages;
  const IndentAction = L.IndentAction;

  if (!L.getLanguages().some((l: any) => l.id === 'mjml')) {
    L.register({ id: 'mjml', extensions: ['.mjml'], aliases: ['MJML'] });
  }

  const tagOpen = /<([a-zA-Z][\w-]*)(\s[^<>]*)?(?<!\/)>(?!.*<\/\1\s*>)/;

  L.setLanguageConfiguration('mjml', {
    comments: { blockComment: ['<!--', '-->'] },
    brackets: [
      ['<!--', '-->'],
      ['<', '>'],
    ],
    autoClosingPairs: [
      { open: '<!--', close: '-->' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '<!--', close: '-->' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    onEnterRules: [
      {
        beforeText: tagOpen,
        afterText: /^\s*<\/\w/,
        action: { indentAction: IndentAction.IndentOutdent },
      },
      { beforeText: tagOpen, action: { indentAction: IndentAction.Indent } },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*<([a-zA-Z][\w-]*)(\s[^<>]*)?(?<!\/)>(?!.*<\/\1\s*>).*$/,
      decreaseIndentPattern: /^\s*<\//,
    },
  });

  L.setMonarchTokensProvider('mjml', {
    tokenizer: {
      root: [
        [/<!--/, 'comment', '@comment'],
        ['<', { token: 'delimiter', next: '@openTag' }],
        [/[^<]+/, ''],
      ],
      comment: [[/-->/, 'comment', '@pop'], [/-+(?!>)/, 'comment'], [/[^\\-]+/, 'comment']],
      openTag: [
        [/\s+/, 'white'],
        // <mj-style> opens CSS mode (attributes still tokenized in mjStyleTagBody).
        // Closing </mj-style> falls through to the generic rule → back to root.
        [/mj-style(?=[\s/>])/, 'tag', '@mjStyleTagBody'],
        [/(\/?)([a-zA-Z][\w-]*)/, ['delimiter', 'tag'], '@tagBody'],
        [/./, 'delimiter', '@pop'],
      ],
      tagBody: [
        [/\s+/, 'white'],
        [/[a-zA-Z_:][\w:.-]*/, 'attribute.name'],
        [/=/, 'delimiter'],
        [/"/, 'attribute.value', '@stringDq'],
        [/'/, 'attribute.value', '@stringSq'],
        [/\/?>/, 'delimiter', '@pop'],
      ],
      stringDq: [[/[^"]+/, 'attribute.value'], [/"/, 'attribute.value', '@pop']],
      stringSq: [[/[^']+/, 'attribute.value'], [/'/, 'attribute.value', '@pop']],
      // Same as tagBody, but the closing `>` enters CSS mode instead of root.
      mjStyleTagBody: [
        [/\s+/, 'white'],
        [/[a-zA-Z_:][\w:.-]*/, 'attribute.name'],
        [/=/, 'delimiter'],
        [/"/, 'attribute.value', '@stringDq'],
        [/'/, 'attribute.value', '@stringSq'],
        [/\/?>/, 'delimiter', '@styleContent'],
      ],
      // CSS inside <mj-style> … </mj-style>.
      styleContent: [
        [/\/\*/, 'comment', '@cssComment'],
        [/(<\/)(mj-style)(\s*)(>)/, ['delimiter', 'tag', 'white', 'delimiter'], '@pop'],
        [/\s+/, 'white'],
        [/@[\w-]+/, 'keyword'],
        [/[{}]/, 'delimiter.bracket'],
        [/[()]/, 'delimiter.parenthesis'],
        [/[;:,]/, 'delimiter'],
        [/#[0-9a-fA-F]+/, 'number.hex'],
        [/(?<![\w#.-])[0-9]+(\.[0-9]+)?(px|em|rem|%|pt|vh|vw)?/, 'number'],
        [/[.#][\w-]+/, 'tag'],
        [/[a-zA-Z-]+(?=\s*:)/, 'attribute.name'],
        [/[a-zA-Z-]+/, 'attribute.value'],
        // Safety hatch: CSS never contains `<` — bail to root on malformed input.
        [/</, 'delimiter', '@pop'],
      ],
      cssComment: [[/\*\//, 'comment', '@pop'], [/[^*]+/, 'comment'], [/\*/, 'comment']],
    },
  });

  L.registerCompletionItemProvider('mjml', {
    triggerCharacters: ['<'],
    provideCompletionItems: () => ({
      suggestions: MJML_TAGS.map((t) => ({
        label: t.name,
        kind: L.CompletionItemKind.Snippet,
        documentation: t.doc,
        insertText: `${t.name}>$0</${t.name}>`,
        insertTextRules: L.CompletionItemInsertTextRule.InsertAsSnippet,
        range: undefined,
      })),
    }),
  });

  L.registerDocumentFormattingEditProvider('mjml', {
    provideDocumentFormattingEdits: (model: any) => [
      { range: model.getFullModelRange(), text: formatMjml(model.getValue()) },
    ],
  });

  registered.add(monaco);
}
