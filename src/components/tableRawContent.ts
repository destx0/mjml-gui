import type { Editor } from 'grapesjs';

// mj-table content is raw HTML (usually <tr>/<td>). Browser HTML parsing
// shreds table-sectioning tags outside a table context (they get dropped),
// both when the page loads markup and when the editor imports an MJML string.
// The official renderer treats the content as opaque raw HTML
// (mjml-table is an endingTag, see mjml-upstream/packages/mjml-table), so the
// editor parses it in a real table context and converts it to editable
// component definitions (row/cell/image/text) instead of letting the generic
// import shred it.
//
// An mj-table element can't be nested inside another one, so matching each
// opening tag with the first following closing tag is safe.

// Matches <mj-table ...>INNER</mj-table>, capturing attrs (1) and inner (2).
const TABLE_RE = /<mj-table(\s[^>]*)?>([\s\S]*?)<\/mj-table\s*>/gi;

export function stashRawTables(input: string): { html: string; raws: string[] } {
  const raws: string[] = [];
  const html = input.replace(TABLE_RE, (_match, attrs = '', inner) => {
    raws.push(inner);
    return `<mj-table${attrs}></mj-table>`;
  });
  return { html, raws };
}

function parseStyleAttr(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  style.split(';').forEach((rule) => {
    const idx = rule.indexOf(':');
    if (idx > 0) {
      const key = rule.slice(0, idx).trim();
      const value = rule.slice(idx + 1).trim();
      if (key && value) result[key] = value;
    }
  });
  return result;
}

function attrsToDef(el: Element) {
  const attributes: Record<string, string> = {};
  const classes: string[] = [];
  let style: Record<string, string> | undefined;
  Array.from(el.attributes).forEach((attr) => {
    if (attr.name === 'style') {
      const parsed = parseStyleAttr(attr.value);
      if (Object.keys(parsed).length) style = parsed;
    } else if (attr.name === 'class') {
      classes.push(...attr.value.split(' ').map((c) => c.trim()).filter(Boolean));
    } else {
      attributes[attr.name] = attr.value;
    }
  });
  return { attributes, classes, style };
}

function nodesToDefs(container: Element): any[] {
  const defs: any[] = [];
  container.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue || '';
      // Drop whitespace-only nodes between table elements, keep real text
      // (including templating placeholders like ${...}).
      if (text.trim()) defs.push({ type: 'textnode', content: text });
    } else if (node.nodeType === 8) {
      // Keep comments (eg. Outlook conditionals) in raw table content.
      defs.push({ type: 'comment', content: node.nodeValue || '' });
    } else if (node.nodeType === 1) {
      defs.push(elToDef(node as Element));
    }
  });
  return defs;
}

function elToDef(el: Element): any {
  const tag = el.tagName.toLowerCase();
  const { attributes, classes, style } = attrsToDef(el);
  const base: any = { tagName: tag };
  if (Object.keys(attributes).length) base.attributes = attributes;
  if (classes.length) base.classes = classes;
  if (style) base.style = style;

  const children = nodesToDefs(el);
  const textOnly = children.length === 1 && children[0].type === 'textnode';

  switch (tag) {
    case 'tbody':
    case 'thead':
    case 'tfoot':
      return { ...base, type: tag, components: children };
    case 'tr':
      return { ...base, type: 'row', components: children };
    case 'td':
    case 'th':
      return { ...base, type: 'cell', components: children };
    case 'img':
      return { ...base, type: 'image' };
    default:
      // Text-only elements become editable text components, anything else
      // stays a generic wrapper so nested content keeps working.
      return textOnly
        ? { ...base, type: 'text', components: children }
        : { ...base, components: children };
  }
}

/**
 * Parse raw mj-table inner HTML in a real table context (so <tr>/<td>
 * survive) and convert it to editable component definitions with explicit
 * types (core row/cell/image/text). Bare <td> content without a <tr> is
 * wrapped so nothing gets dropped.
 */
export function parseTableDefs(raw: string): any[] {
  const holder = document.createElement('table');
  holder.innerHTML = /<tr[\s>]/i.test(raw) ? raw : `<tr>${raw}</tr>`;
  return nodesToDefs(holder);
}

function collectTables(defs: any, out: any[] = []): any[] {
  const list = Array.isArray(defs) ? defs : [defs];
  for (const def of list) {
    if (!def || typeof def !== 'object') continue;
    if (typeof def.tagName === 'string' && def.tagName.toLowerCase() === 'mj-table') {
      out.push(def);
    }
    if (def.components) collectTables(def.components, out);
  }
  return out;
}

export function restoreTableDefs(defs: any, raws: string[]) {
  const tables = collectTables(defs);
  const count = Math.min(tables.length, raws.length);
  for (let i = 0; i < count; i++) {
    // Replace the shredded child definitions with editable components parsed
    // in a table context. Export serializes these back to equivalent raw HTML.
    tables[i].components = parseTableDefs(raws[i]);
  }
}

/**
 * Patch the single string entry point of the editor parser
 * (Components.parseString -> Parser.parseHtml) so every MJML string import
 * (paste, blocks, code view, API) keeps raw mj-table content as editable
 * components instead of shredded fragments.
 */
export function installRawTableParser(editor: Editor) {
  const parser: any = (editor as any).Parser;
  if (!parser || parser.__mjmlRawTablePatched) return;
  const origParseHtml = parser.parseHtml.bind(parser);
  parser.parseHtml = (input: string, options: any = {}) => {
    if (typeof input !== 'string') return origParseHtml(input, options);
    const { html, raws } = stashRawTables(input);
    const result = origParseHtml(html, options);
    if (raws.length && result && result.html) {
      restoreTableDefs(result.html, raws);
    }
    return result;
  };
  parser.__mjmlRawTablePatched = true;
}
