import type { Editor } from 'grapesjs';

// mj-table content is raw HTML (usually <tr>/<td>). Browser HTML parsing
// shreds table-sectioning tags outside a table context (they get dropped or
// foster-parented), both when the page loads markup and when the editor
// imports an MJML string. The official renderer treats the content as opaque
// (mjml-table is an endingTag, see mjml-upstream/packages/mjml-table), so the
// editor has to preserve it opaquely as well: stash the raw inners before
// parsing and reattach them to the parsed mj-table definitions.
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

export function restoreRawTables(defs: any, raws: string[]) {
  const tables = collectTables(defs);
  const count = Math.min(tables.length, raws.length);
  for (let i = 0; i < count; i++) {
    // Keep the raw inner MJML on the definition (becomes a model prop) and
    // drop the shredded child definitions (the browser already destroyed the
    // <tr>/<td> structure while parsing).
    tables[i].rawContent = raws[i];
    tables[i].components = [];
  }
}

/**
 * Patch the single string entry point of the editor parser
 * (Components.parseString -> Parser.parseHtml) so every MJML string import
 * (paste, blocks, code view, API) preserves raw mj-table content.
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
      restoreRawTables(result.html, raws);
    }
    return result;
  };
  parser.__mjmlRawTablePatched = true;
}
