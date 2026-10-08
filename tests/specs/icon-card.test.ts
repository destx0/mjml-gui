import grapesjs, { Editor } from "grapesjs";
import grapesJSMJML from "../../src";
import { LAYOUT_PROPS, cardCss, deriveLayout, getColumns, sizeClassName } from "../../src/components/IconCard";

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
    expect(deriveLayout(card)).toEqual({ position: "left", sizes: { mobile: 60 }, gap: 16, valign: "middle", stack: false });
    expect(card.get(LAYOUT_PROPS.position)).toBe("left");
    expect(compile().errors).toHaveLength(0);
  });

  test("layouts are derived from every preset", () => {
    expect(deriveLayout(load("mj-icon-card-right")).position).toBe("right");
    const top = deriveLayout(load("mj-icon-card-top"));
    expect(top.position).toBe("top");
    expect(top.sizes).toEqual({ mobile: 64 });
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

  test("icon size is fixed per breakpoint and stored on the icon image", () => {
    const card = load("mj-icon-card");
    card.set(LAYOUT_PROPS.sizeMobile, 40);
    card.set(LAYOUT_PROPS.sizeDesktop, 60);
    const image = card.findType("mj-image")[0];
    expect(image.getAttributes().width).toBe("40px");
    expect(image.get("responsive")).toEqual({ desktop: { width: "60px" } });
    expect(deriveLayout(card).sizes).toEqual({ mobile: 40, desktop: 60 });

    // Fallback % widths follow the Mobile icon box (40 + 16 gap of 600).
    const [icon, content] = getColumns(card);
    expect(icon.getAttributes().width).toBe("9.34%");
    expect(content.getAttributes().width).toBe("90.66%");

    // Clearing a breakpoint makes it inherit again.
    card.set(LAYOUT_PROPS.sizeDesktop, "");
    expect(image.get("responsive")).toBeUndefined();
  });

  test("generated rules pin the icon column and let the content fill the rest", () => {
    const layout = { position: "left" as const, sizes: { mobile: 40, desktop: 60 }, gap: 16, valign: "middle" as const, stack: false };
    const token = sizeClassName(layout);
    expect(token).toBe("icon-card--56-56-76");
    const css = cardCss(layout);
    expect(css.mobile).toEqual([
      `.${token} .icon-card-icon { width: 56px !important; max-width: 56px !important; }`,
      `.${token} .icon-card-body { width: calc(100% - 56px) !important; max-width: calc(100% - 56px) !important; }`,
    ]);
    expect(css.tablet).toBeUndefined(); // inherits Mobile
    expect(css.desktop![0]).toContain("width: 76px !important");

    // Stacked on mobile: no base rule, columns un-stack from Tablet up.
    const stacked = cardCss({ ...layout, stack: true });
    expect(stacked.mobile).toBeUndefined();
    expect(stacked.tablet![0]).toContain("width: 56px !important");

    expect(cardCss({ ...layout, position: "top" })).toEqual({});
  });

  test("export carries the size class and the generated rules", () => {
    const card = load("mj-icon-card");
    card.set(LAYOUT_PROPS.sizeMobile, 40);
    card.set(LAYOUT_PROPS.sizeDesktop, 60);
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).toContain('css-class="icon-card icon-card--56-56-76"');
    expect(mjml).toContain('css-class="icon-card-icon"');
    expect(mjml).toContain(".icon-card--56-56-76 .icon-card-icon { width: 56px !important;");
    const desktopBlock = mjml.slice(mjml.indexOf("@media only screen and (min-width: 768px)"));
    expect(desktopBlock).toContain(".icon-card--56-56-76 .icon-card-icon { width: 76px !important;");
    const { html, errors } = compile();
    expect(errors).toHaveLength(0);
    expect(html).toContain("icon-card--56-56-76");
  });

  test("padding changes keep the fallback widths right", () => {
    const card = load("mj-icon-card");
    card.set(LAYOUT_PROPS.gap, 20);
    card.addAttributes({ padding: "12px 50px" });
    const [icon, content] = getColumns(card);
    expect(icon.getAttributes().width).toBe("16%"); // (60 + 20) / 500
    expect(content.getAttributes().width).toBe("84%");
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
    card.set(LAYOUT_PROPS.sizeDesktop, 72);
    const mjml = editor.Commands.run("mjml-code") as string;
    expect(mjml).toContain('css-class="icon-card icon-card--');
    expect(mjml).not.toContain("mj-icon-card");
    const before = deriveLayout(card);
    expect(before.position).toBe("right");

    editor.setComponents(mjml);
    const again = editor.getWrapper()!.findType("mj-icon-card")[0] as any;
    expect(again).toBeTruthy();
    expect(deriveLayout(again)).toEqual(before);
    expect(before.sizes).toEqual({ mobile: 60, desktop: 72 });
    // The generated size class is not kept as a real class on import.
    expect(again.getAttributes()["css-class"]).toBe("icon-card");
    // Attribute order may change once; after that the export is stable.
    const reexported = editor.Commands.run("mjml-code") as string;
    editor.setComponents(reexported);
    // `mjr-c<id>` override tokens come from per-session component ids.
    const normalize = (code: string) => code.replace(/mjr-c\d+/g, "mjr-c#");
    expect(normalize(editor.Commands.run("mjml-code"))).toBe(normalize(reexported));
    expect(compile().errors).toHaveLength(0);
  });

  test("per-breakpoint sizes from imported MJML show in the card settings", () => {
    const card = load("mj-icon-card");
    card.set(LAYOUT_PROPS.sizeMobile, 40);
    card.set(LAYOUT_PROPS.sizeDesktop, 64);
    editor.setComponents(editor.Commands.run("mjml-code") as string);
    const again = editor.getWrapper()!.findType("mj-icon-card")[0] as any;
    expect(again.get(LAYOUT_PROPS.sizeMobile)).toBe(40);
    expect(again.get(LAYOUT_PROPS.sizeDesktop)).toBe(64);
  });

  test("plain sections are not icon cards", () => {
    editor.setComponents(`<mjml><mj-body><mj-section css-class="other"><mj-column/></mj-section></mj-body></mjml>`);
    expect(editor.getWrapper()!.findType("mj-icon-card")).toHaveLength(0);
    expect(editor.getWrapper()!.findType("mj-section")).toHaveLength(1);
  });
});
