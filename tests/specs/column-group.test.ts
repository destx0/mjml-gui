import mjmlConvert from "../../src/components/parser";
import loadColumn from "../../src/components/Column";

// The column canvas preview (src/components/Column.ts) renders each column in
// isolation. Columns of an mj-group have to be rendered inside an mj-group
// wrapper, otherwise the official renderer misses the group context
// (mj-group passes `mobileWidth` to its columns, see
// mjml-upstream/packages/mjml-group/src/index.js) and falls back to the
// mobile-first `width:100%`. That stacked group columns in the canvas below
// the breakpoint while the exported HTML stayed side-by-side.

function columnDivs(mjml: string): string[] {
  const { html, errors }: any = mjmlConvert(mjml, {} as any);
  expect(errors).toHaveLength(0);
  const divs = html.match(/<div[^>]*mj-column[^>]*>/g) || [];
  return divs.map((d: string) => d.replace(/\s+/g, " "));
}

describe("column preview widths", () => {
  test("section column preview keeps mobile-first 100% inline width", () => {
    const divs = columnDivs(
      `<mjml><mj-body><mj-section><mj-column width="80px"></mj-column><mj-column></mj-column></mj-section></mj-body></mjml>`
    );
    expect(divs[0]).toContain("mj-column-px-80");
    expect(divs[0]).toContain("width:100%");
  });

  test("group column preview keeps fluid % inline width (no stacking)", () => {
    const divs = columnDivs(
      `<mjml><mj-body><mj-section><mj-group><mj-column width="80px"></mj-column><mj-column width="520px"></mj-column></mj-group></mj-section></mj-body></mjml>`
    );
    // First match is the group div itself (mj-column-per-100), the actual
    // columns come after it.
    const cols = divs.filter((d) => d.includes("mj-column-px-"));
    expect(cols).toHaveLength(2);
    expect(cols[0]).toContain("mj-column-px-80");
    expect(cols[0]).toMatch(/width:13\.3333\d*%/);
    expect(cols[0]).not.toContain("width:100%");
    expect(cols[1]).toContain("mj-column-px-520");
    expect(cols[1]).toMatch(/width:86\.6666\d*%/);
    expect(cols[1]).not.toContain("width:100%");
  });
});

describe("column view group preview", () => {
  const mockOpts: any = { columnsPadding: "10px 0" };
  let viewDef: any;

  const mockEditor: any = {
    I18n: { t: (k: string) => k },
    Components: {
      addType: (_type: string, def: any) => {
        viewDef = def;
      },
    },
  };

  beforeEach(() => {
    loadColumn(mockEditor, { opt: mockOpts } as any);
  });

  const mockModel = (parentType: string | undefined, length = 2) => ({
    collection: { length },
    parent: () => (parentType ? { get: (k: string) => (k === "type" ? parentType : undefined) } : undefined),
  });

  test("wraps preview template in mj-group for group children only", () => {
    const groupCtx: any = { model: mockModel("mj-group") };
    const groupTmpl = viewDef.view.getMjmlTemplate.call({ ...groupCtx, isInGroupPreview: viewDef.view.isInGroupPreview });
    expect(groupTmpl.start).toContain("<mj-group>");
    expect(groupTmpl.end).toContain("</mj-group>");

    const sectionCtx: any = { model: mockModel("mj-section") };
    const sectionTmpl = viewDef.view.getMjmlTemplate.call({ ...sectionCtx, isInGroupPreview: viewDef.view.isInGroupPreview });
    expect(sectionTmpl.start).not.toContain("<mj-group>");
    expect(sectionTmpl.end).not.toContain("</mj-group>");
  });

  test("extracts the column div (not the group div) from group preview", () => {
    const { html }: any = mjmlConvert(
      `<mjml><mj-body><mj-section><mj-group><mj-column width="80px"></mj-column><mj-column></mj-column></mj-group></mj-section></mj-body></mjml>`,
      {} as any
    );
    // Same body extraction as the column view (src/components/Column.ts)
    const content = html.replace(/<body(.*)>/, "<body>");
    const start = content.indexOf("<body>") + 6;
    const end = content.indexOf("</body>");
    const sandboxEl = document.createElement("div");
    sandboxEl.innerHTML = content.substring(start, end).trim();

    const ctx: any = { isInGroupPreview: () => true };
    const el = viewDef.view.getTemplateFromEl.call(ctx, sandboxEl);
    expect(el.className).toContain("mj-column-px-80");
    expect(el.getAttribute("style")).toMatch(/width:13\.3333\d*%/);
  });
});
