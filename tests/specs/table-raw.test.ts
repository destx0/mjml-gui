import grapesjs, { Editor } from "grapesjs";
import * as fs from "fs";
import grapesJSMJML from "../../src";
import { stashRawTables, restoreRawTables } from "../../src/components/tableRawContent";

// mj-table content is raw HTML (usually <tr>/<td>). Browser HTML parsing
// shreds table-sectioning tags outside a table context, so the plugin has to
// preserve the raw content opaquely through import, canvas preview and export.

const fundMjml = fs.readFileSync("/tmp/mjml-ref-test/fund-row.mjml", "utf-8");

describe("table raw content helpers", () => {
  test("stashes and restores raw inners in document order", () => {
    const input = `<mjml><mj-body><mj-section><mj-column><mj-table padding="0"><tr><td width="60">A</td></tr></mj-table></mj-column><mj-column><mj-table><tr><td>B</td></tr></mj-table></mj-column></mj-section></mj-body></mjml>`;
    const { html, raws } = stashRawTables(input);
    expect(raws).toHaveLength(2);
    expect(raws[0]).toContain('<td width="60">A</td>');
    expect(raws[1]).toContain("<td>B</td>");
    expect(html).not.toContain("<tr>");

    const defs: any = [
      { tagName: "mj-column", components: [{ tagName: "mj-table", components: [{ tagName: "img" }] }] },
      { tagName: "mj-column", components: [{ tagName: "mj-table", components: [] }] },
    ];
    restoreRawTables(defs, raws);
    expect(defs[0].components[0].rawContent).toContain('<td width="60">A</td>');
    expect(defs[0].components[0].components).toHaveLength(0);
    expect(defs[1].components[0].rawContent).toContain("<td>B</td>");
  });

  test("leaves strings without mj-table untouched", () => {
    const input = `<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>`;
    const { html, raws } = stashRawTables(input);
    expect(raws).toHaveLength(0);
    expect(html).toBe(input);
  });
});

describe("mj-table round trip", () => {
  let editor: Editor;

  beforeEach((done) => {
    const e = grapesjs.init({
      container: "#gjs",
      plugins: [grapesJSMJML],
    });
    editor = e;
    editor.getModel().loadOnStart();
    editor.on("change:readyLoad", () => done());
  });

  afterEach(() => {
    editor.destroy();
  });

  test("import preserves raw content with no shredded children", () => {
    editor.addComponents(fundMjml);
    const tables = editor.DomComponents.getWrapper()?.findType("mj-table") || [];
    expect(tables).toHaveLength(1);
    const table = tables[0] as any;
    expect(table.get("rawContent")).toContain("<tr>");
    expect(table.get("rawContent")).toContain('<td width="60"');
    expect(table.components()).toHaveLength(0);
  });

  test("exported MJML keeps structure, src and placeholders", () => {
    editor.addComponents(fundMjml);
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).toContain("<tr>");
    expect(mjml).toContain('<td width="60"');
    expect(mjml).toContain("cid:FundInvested");
    expect(mjml).toContain("${currentFundName}");
    expect(mjml).not.toContain("data:image/svg");
    // Explicit zero paddings survive (style defaults must not leak back in)
    expect(mjml).toContain('padding="0"');
  });

  test("exported MJML recompiles without errors", () => {
    editor.addComponents(fundMjml);
    const { errors, html } = editor.Commands.run("mjml-code-to-html");
    expect(errors).toHaveLength(0);
    expect(html).toContain('<td width="60"');
    expect(html).toContain("cid:FundInvested");
  });
});
