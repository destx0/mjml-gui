import grapesjs, { Editor } from "grapesjs";
import grapesJSMJML from "../../src";
import { buildIconTextMjml, defaults } from "../../src/components/IconText";

describe("icon-text builder", () => {
  test("builds standard MJML with fixed icon cell and auto text cell", () => {
    const mjml = buildIconTextMjml({});
    expect(mjml).toContain("<mj-section");
    expect(mjml).toContain("<mj-table");
    expect(mjml).toContain('<td width="60"');
    expect(mjml).toContain("Your money is invested in:");
    expect(mjml).toContain("${currentFundName}");
    expect(mjml).not.toContain("mj-icon-text");
    // No percentage widths in the row itself (img width:100% excluded)
    const rowOnly = mjml.substring(mjml.indexOf("<tr>")).replace("width:100%;", "");
    expect(rowOnly).not.toContain("%");
  });

  test("escapes attribute and text values", () => {
    const mjml = buildIconTextMjml({
      ...defaults,
      title: 'A "quoted" <b>title</b>',
      description: "5 > 3 & 2 < 4",
      "image-src": 'https://x.com/a"b',
    });
    // Quotes stay literal in text nodes (only & < > are escaped there)
    expect(mjml).toContain('A "quoted" &lt;b&gt;title&lt;/b&gt;');
    expect(mjml).toContain("5 &gt; 3 &amp; 2 &lt; 4");
    expect(mjml).toContain('src="https://x.com/a&quot;b"');
  });

  test("omits empty lines and zero radius", () => {
    const mjml = buildIconTextMjml({ ...defaults, title: "  ", "image-radius": "0" });
    expect(mjml).not.toContain("fs-18");
    expect(mjml).not.toContain("border-radius");
    const rounded = buildIconTextMjml({ ...defaults, "image-radius": "50%" });
    expect(rounded).toContain("border-radius:50%;");
  });
});

describe("icon-text component", () => {
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

  test("block and type are registered", () => {
    expect(editor.BlockManager.get("mj-icon-text")).toBeTruthy();
    expect(editor.DomComponents.getType("mj-icon-text")).toBeTruthy();
  });

  test("exports standard MJML that compiles without errors", () => {
    editor.addComponents(
      `<mjml><mj-body><mj-icon-text image-src="cid:FundInvested" icon-width="60" title="Your money is invested in:" description="\${currentFundName}" /></mj-body></mjml>`
    );
    const found = editor.DomComponents.getWrapper()?.findType("mj-icon-text") || [];
    expect(found).toHaveLength(1);
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).not.toContain("mj-icon-text");
    expect(mjml).toContain("<mj-section");
    expect(mjml).toContain('<td width="60"');
    expect(mjml).toContain("cid:FundInvested");
    expect(mjml).toContain("${currentFundName}");
    const { errors, html } = editor.Commands.run("mjml-code-to-html");
    expect(errors).toHaveLength(0);
    expect(html).toContain('<td width="60"');
  });

  test("trait edit flows through to export", () => {
    editor.addComponents(`<mjml><mj-body><mj-icon-text /></mj-body></mjml>`);
    const found = editor.DomComponents.getWrapper()?.findType("mj-icon-text") || [];
    const comp = found[0] as any;
    comp.addAttributes({ title: "Edited title", "icon-width": "80" });
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).toContain("Edited title");
    expect(mjml).toContain('<td width="80"');
    const { errors } = editor.Commands.run("mjml-code-to-html");
    expect(errors).toHaveLength(0);
  });
});
