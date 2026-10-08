import grapesjs, { Editor } from "grapesjs";
import grapesJSMJML from "../../src";
import { LAYOUT_PROPS, deriveLayout, getColumns } from "../../src/components/IconCard";

describe("icon card", () => {
  let editor: Editor;

  beforeEach((done) => {
    editor = grapesjs.init({ container: "#gjs", plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on("change:readyLoad", () => done());
  });

  afterEach(async () => {
    // Let debounced UI updates (Style Manager etc.) run before teardown.
    await new Promise((resolve) => setTimeout(resolve));
    editor.destroy();
  });

  const load = (blockId: string) => {
    const block = editor.Blocks.get(blockId) as any;
    editor.setComponents(`<mjml><mj-body>${block.get("content")}</mj-body></mjml>`);
    return editor.getWrapper()!.findType("mj-icon-card")[0] as any;
  };
  const px = (cmp: any) => parseFloat(cmp.getAttributes().width);
  const compile = () => editor.Commands.run("mjml-code-to-html");

  test("block is recognised as an icon card made of real components", () => {
    const card = load("mj-icon-card");
    expect(card).toBeTruthy();
    expect(card.findType("mj-text")).toHaveLength(2);
    expect(card.findType("mj-image")).toHaveLength(1);
    expect(deriveLayout(card)).toEqual({ position: "left", size: 60, gap: 16, valign: "middle", stack: false });
    expect(card.get(LAYOUT_PROPS.position)).toBe("left");
    expect(compile().errors).toHaveLength(0);
  });

  test("layouts are derived from every preset", () => {
    expect(deriveLayout(load("mj-icon-card-right")).position).toBe("right");
    const top = deriveLayout(load("mj-icon-card-top"));
    expect(top.position).toBe("top");
    expect(top.size).toBe(64);
    expect(top.gap).toBe(16);
  });

  test("changing position moves the same components and keeps their overrides", () => {
    const card = load("mj-icon-card");
    const title = card.findType("mj-text")[0];
    title.set("responsive", { desktop: { "font-size": "28px" } });
    const image = card.findType("mj-image")[0];

    card.set(LAYOUT_PROPS.position, "right");
    let cols = getColumns(card);
    expect(cols[1].components().at(0)).toBe(image);
    expect(cols[0].components().at(0)).toBe(title);

    card.set(LAYOUT_PROPS.position, "top");
    cols = getColumns(card);
    expect(cols).toHaveLength(1);
    expect(cols[0].components().map((c: any) => c.cid)).toEqual([image.cid, ...card.findType("mj-text").map((c: any) => c.cid)]);

    card.set(LAYOUT_PROPS.position, "left");
    expect(card.findType("mj-text")[0]).toBe(title);
    expect(title.get("responsive")).toEqual({ desktop: { "font-size": "28px" } });
    expect(compile().errors).toHaveLength(0);
  });

  test("column widths are percentages of the available width", () => {
    const card = load("mj-icon-card");
    card.set(LAYOUT_PROPS.size, 80);
    card.set(LAYOUT_PROPS.gap, 20);
    let [icon, content] = getColumns(card);
    expect(icon.getAttributes().width).toBe("16.67%"); // 100 / 600
    expect(content.getAttributes().width).toBe("83.33%");
    expect(card.findType("mj-image")[0].getAttributes().width).toBe("80px");

    // Card padding shrinks the available width: the icon's share grows.
    card.addAttributes({ padding: "12px 50px" });
    [icon, content] = getColumns(card);
    expect(icon.getAttributes().width).toBe("20%"); // 100 / 500
    expect(content.getAttributes().width).toBe("80%");
    expect(compile().errors).toHaveLength(0);
  });

  test("stack on mobile toggles the mj-group", () => {
    const card = load("mj-icon-card");
    expect(card.findType("mj-group")).toHaveLength(1);
    card.set(LAYOUT_PROPS.stack, true);
    expect(card.findType("mj-group")).toHaveLength(0);
    expect(getColumns(card)).toHaveLength(2);
    card.set(LAYOUT_PROPS.stack, false);
    expect(card.findType("mj-group")).toHaveLength(1);
  });

  test("vertical alignment applies to both columns", () => {
    const card = load("mj-icon-card");
    card.set(LAYOUT_PROPS.valign, "top");
    getColumns(card).forEach((col: any) => expect(col.getAttributes()["vertical-align"]).toBe("top"));
  });

  test("dropped content survives layout changes", () => {
    const card = load("mj-icon-card");
    const [, content] = getColumns(card);
    content.components().add({ type: "mj-button", content: "Go" });
    card.set(LAYOUT_PROPS.position, "top");
    card.set(LAYOUT_PROPS.position, "right");
    expect(card.findType("mj-button")).toHaveLength(1);
    expect(card.findType("mj-text")).toHaveLength(2);
  });

  test("round-trips through exported MJML", () => {
    const card = load("mj-icon-card");
    card.set(LAYOUT_PROPS.position, "right");
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).toContain('css-class="icon-card"');
    expect(mjml).not.toContain("mj-icon-card");
    const before = deriveLayout(card);
    expect(before.position).toBe("right");

    editor.setComponents(mjml);
    const again = editor.getWrapper()!.findType("mj-icon-card")[0] as any;
    expect(again).toBeTruthy();
    expect(deriveLayout(again)).toEqual(before);
    // Attribute order may change once; after that the export is stable.
    const reexported = editor.Commands.run("mjml-code") as string;
    editor.setComponents(reexported);
    expect(editor.Commands.run("mjml-code")).toBe(reexported);
    expect(compile().errors).toHaveLength(0);
  });

  test("plain sections are not icon cards", () => {
    editor.setComponents(`<mjml><mj-body><mj-section css-class="other"><mj-column/></mj-section></mj-body></mjml>`);
    expect(editor.getWrapper()!.findType("mj-icon-card")).toHaveLength(0);
    expect(editor.getWrapper()!.findType("mj-section")).toHaveLength(1);
  });
});
