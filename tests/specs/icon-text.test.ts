import grapesjs, { Editor } from "grapesjs";
import grapesJSMJML from "../../src";
import {
  buildIconTextMjml,
  buildMetaComment,
  defaults,
  parseMetaComment,
} from "../../src/components/IconText";

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

  afterEach(async () => {
    // Let debounced UI updates (Style Manager etc.) run before teardown.
    await new Promise((resolve) => setTimeout(resolve));
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
    // Only the round-trip meta comment mentions it, never as a tag.
    expect(mjml).not.toContain("<mj-icon-text");
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

  const getCard = () => editor.getWrapper()!.findType("mj-icon-text")[0] as any;

  // jsdom has no canvas frame: run the view's inline editor on a stub view
  // whose element holds the compiled preview.
  const inlineEdit = (card: any, field: string) => {
    const proto = (editor.DomComponents.getType("mj-icon-text") as any).view.prototype;
    const root = document.createElement("div");
    root.innerHTML = buildIconTextMjml(card.getAttributes(), { preview: true })
      .replace(/<\/?mj-[^>]*>/g, "");
    document.body.appendChild(root);
    const el = root.querySelector(`[data-it-field="${field}"]`) as HTMLElement;
    proto.startInlineEdit.call({ model: card, rerender() {} }, el, field);
    return el;
  };

  test("round-trips through exported MJML", () => {
    editor.setComponents(`<mjml><mj-body><mj-icon-text /></mj-body></mjml>`);
    getCard().addAttributes({
      title: "Rock -- solid",
      "icon-position": "right",
      href: "https://example.com",
      "background-color": "#f3f4f6",
    });
    const mjml = editor.Commands.run("mjml-code") as string;

    editor.setComponents(mjml);
    const cards = editor.getWrapper()!.findType("mj-icon-text");
    expect(cards).toHaveLength(1);
    const attrs = (cards[0] as any).getAttributes();
    expect(attrs.title).toBe("Rock -- solid");
    expect(attrs["icon-position"]).toBe("right");
    expect(attrs.href).toBe("https://example.com");
    expect(attrs.description).toBe("${currentFundName}");
    // No leftover section/comment from the export.
    expect(editor.getWrapper()!.findType("mj-section")).toHaveLength(0);
    expect(editor.Commands.run("mjml-code")).toBe(mjml);
  });

  test("clearing an option keeps later edits working", () => {
    editor.setComponents(`<mjml><mj-body><mj-icon-text href="https://a.b" /></mj-body></mjml>`);
    const card = getCard();
    card.addAttributes({ href: "" });
    card.addAttributes({ title: "After clear" });
    const attrs = card.getAttributes();
    expect(attrs.title).toBe("After clear");
    expect(attrs.href).toBeUndefined();
  });

  test("inline edit writes the text back to the attribute", () => {
    editor.setComponents(`<mjml><mj-body><mj-icon-text /></mj-body></mjml>`);
    const card = getCard();
    const el = inlineEdit(card, "title");
    expect(el.getAttribute("contenteditable")).toBe("true");
    el.textContent = "  Typed   on canvas ";
    el.dispatchEvent(new Event("blur"));
    expect(card.getAttributes().title).toBe("Typed on canvas");
  });

  test("escape cancels an inline edit", () => {
    editor.setComponents(`<mjml><mj-body><mj-icon-text /></mj-body></mjml>`);
    const card = getCard();
    const el = inlineEdit(card, "description");
    el.textContent = "discard me";
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(card.getAttributes().description).toBe("${currentFundName}");
  });

  test("traits are grouped and use the image picker", () => {
    editor.setComponents(`<mjml><mj-body><mj-icon-text /></mj-body></mjml>`);
    const traits = getCard().get("traits").map((t: any) => t.get("type"));
    expect(traits.filter((t: string) => t === "mj-trait-group").length).toBeGreaterThanOrEqual(5);
    expect(traits).toContain("mj-image-picker");
  });
});

describe("icon-text layouts", () => {
  test("preview markers only in preview mode", () => {
    expect(buildIconTextMjml({})).not.toContain("data-it-field");
    const preview = buildIconTextMjml({}, { preview: true });
    expect(preview).toContain('data-it-field="title"');
    expect(preview).toContain('data-it-field="description"');
    expect(preview).toContain('data-it-field="image"');
  });

  test("icon on the right puts the text cell first", () => {
    const mjml = buildIconTextMjml({ "icon-position": "right" });
    expect(mjml.indexOf("fs-18")).toBeLessThan(mjml.indexOf("<img"));
  });

  test("icon on top stacks rows and follows text alignment", () => {
    const mjml = buildIconTextMjml({ "icon-position": "top", "text-align": "center" });
    expect((mjml.match(/<tr>/g) || []).length).toBe(2);
    expect(mjml).toContain('<td align="center"');
    expect(mjml).toContain("display:inline-block");
  });

  test("link wraps image and title", () => {
    const mjml = buildIconTextMjml({ href: "https://x.y/?a=1&b=2" });
    expect((mjml.match(/<a href="https:\/\/x\.y\/\?a=1&amp;b=2"/g) || []).length).toBe(2);
  });

  test("card options map to mj-section attributes", () => {
    const mjml = buildIconTextMjml({
      "background-color": "#fff",
      padding: "16px",
      "border-radius": "8",
      border: "1px solid #ddd",
    });
    expect(mjml).toContain('<mj-section padding="16px" background-color="#fff" border-radius="8px" border="1px solid #ddd">');
  });

  test("no image src drops the icon cell", () => {
    expect(buildIconTextMjml({ "image-src": "" })).not.toContain("<img");
  });

  test("meta comment never contains a double dash", () => {
    const comment = buildMetaComment({ title: "a -- b -->" });
    const body = comment.slice(4, -3);
    expect(body).not.toContain("--");
    expect(parseMetaComment(body)).toEqual({ title: "a -- b -->" });
  });

  test("meta parser ignores unrelated comments", () => {
    expect(parseMetaComment(" just a comment ")).toBeNull();
    expect(parseMetaComment("mj-icon-text {broken")).toBeNull();
  });
});
