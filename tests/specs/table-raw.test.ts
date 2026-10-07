import grapesjs, { Editor } from "grapesjs";
import * as fs from "fs";
import grapesJSMJML from "../../src";
import { stashRawTables, parseTableDefs } from "../../src/components/tableRawContent";

// mj-table content is raw HTML (usually <tr>/<td>). Browser HTML parsing
// shreds table-sectioning tags outside a table context, so the plugin parses
// the raw content in a table context into editable row/cell components.

const fundMjml = fs.readFileSync("/tmp/mjml-ref-test/fund-row.mjml", "utf-8");

describe("table raw content helpers", () => {
  test("stashes raw inners in document order", () => {
    const input = `<mjml><mj-body><mj-section><mj-column><mj-table padding="0"><tr><td width="60">A</td></tr></mj-table></mj-column><mj-column><mj-table><tr><td>B</td></tr></mj-table></mj-column></mj-section></mj-body></mjml>`;
    const { html, raws } = stashRawTables(input);
    expect(raws).toHaveLength(2);
    expect(raws[0]).toContain('<td width="60">A</td>');
    expect(raws[1]).toContain("<td>B</td>");
    expect(html).not.toContain("<tr>");
  });

  test("leaves strings without mj-table untouched", () => {
    const input = `<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>`;
    const { html, raws } = stashRawTables(input);
    expect(raws).toHaveLength(0);
    expect(html).toBe(input);
  });

  test("parses rows/cells into typed editable defs", () => {
    const defs = parseTableDefs(
      `<tr><td width="60" align="left" style="padding:6px 8px 6px 0;word-break:break-word;"><img alt="" src="cid:FundInvested" width="60" height="60" /></td><td align="left"><div class="fs-18">Your money is invested in:</div><div>\${currentFundName}</div></td></tr>`
    );
    // Table-context parsing wraps rows in tbody (same as browsers/email
    // clients do); the row/cell structure underneath is what matters.
    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe("tbody");
    const row = defs[0].components[0];
    expect(row.type).toBe("row");
    expect(row.components).toHaveLength(2);
    const [imgCell, textCell] = row.components;
    expect(imgCell.type).toBe("cell");
    expect(imgCell.attributes).toMatchObject({ width: "60", align: "left" });
    expect(imgCell.style).toMatchObject({ padding: "6px 8px 6px 0", "word-break": "break-word" });
    expect(imgCell.components[0].type).toBe("image");
    expect(imgCell.components[0].attributes.src).toBe("cid:FundInvested");
    expect(textCell.type).toBe("cell");
    expect(textCell.components[0].type).toBe("text");
    expect(textCell.components[1].components[0].content).toContain("${currentFundName}");
  });

  test("wraps bare td content and keeps comments", () => {
    const defs = parseTableDefs(`<td width="60">A</td><!--[if mso]>outlook<![endif]-->`);
    expect(defs[0].type).toBe("tbody");
    const row = defs[0].components[0];
    expect(row).toMatchObject({ type: "row" });
    expect(row.components[0]).toMatchObject({ type: "cell" });
    expect(row.components[1]).toMatchObject({ type: "comment" });
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

  const getTable = () => editor.DomComponents.getWrapper()?.findType("mj-table")[0] as any;

  test("import builds editable row/cell structure, nothing shredded", () => {
    editor.addComponents(fundMjml);
    const table = getTable();
    expect(table).toBeTruthy();
    expect(table.components().length).toBe(1);
    const tbody = table.components().at(0);
    expect(tbody.get("type")).toBe("tbody");
    const rows = tbody.components();
    expect(rows.length).toBe(1);
    expect(rows.at(0).get("type")).toBe("row");
    const cells = rows.at(0).components();
    expect(cells.length).toBe(2);
    expect(cells.map((c: any) => c.get("type"))).toEqual(["cell", "cell"]);
    expect(cells.at(0).getAttributes().width).toBe("60");
    const imgAndTexts = cells.at(0).components();
    expect(imgAndTexts.length).toBe(1);
    expect(imgAndTexts.at(0).get("type")).toBe("image");
    expect(imgAndTexts.at(0).get("src")).toBe("cid:FundInvested");
    expect(cells.at(1).components().at(0).get("type")).toBe("text");
  });

  test("exported MJML keeps structure, src and placeholders", () => {
    editor.addComponents(fundMjml);
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).toContain("<tr>");
    expect(mjml).toContain('<td width="60"');
    expect(mjml).toContain("cid:FundInvested");
    expect(mjml).toContain("${currentFundName}");
    expect(mjml).not.toContain("data:image/svg");
    expect(mjml).toContain('padding="0"');
  });

  test("exported MJML recompiles without errors", () => {
    editor.addComponents(fundMjml);
    const { errors, html } = editor.Commands.run("mjml-code-to-html");
    expect(errors).toHaveLength(0);
    expect(html).toContain('<td width="60"');
    expect(html).toContain("cid:FundInvested");
  });

  test("GUI text edit flows through to export", () => {
    editor.addComponents(fundMjml);
    const table = getTable();
    const firstText = table.findType("text")[0] as any;
    expect(firstText).toBeTruthy();
    // Simulate what the RTE does when the user edits text in the canvas.
    firstText.components().reset([{ type: "textnode", content: "Edited in GUI" }]);
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).toContain("Edited in GUI");
    const { errors } = editor.Commands.run("mjml-code-to-html");
    expect(errors).toHaveLength(0);
  });
});
