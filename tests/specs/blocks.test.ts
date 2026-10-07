import grapesjs, { Editor } from "grapesjs";
import grapesJSMJML from "../../src";
import { blockIcons, categoryOrder } from "../../src/blockIcons";

describe("blocks", () => {
  let editor: Editor;

  beforeEach((done) => {
    editor = grapesjs.init({ container: "#gjs", plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on("change:readyLoad", () => done());
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve));
    editor.destroy();
  });

  const catId = (block: any) => {
    const cat = block.get("category");
    return cat && (cat.get ? cat.get("id") : cat.id || cat);
  };

  test("every default block has a themed SVG thumbnail", () => {
    const blocks = editor.Blocks.getAll();
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block: any) => {
      expect(block.get("media")).toBe(blockIcons[block.getId()]);
      expect(block.get("media")).toContain('class="mj-block-icon"');
    });
  });

  test("blocks are added grouped in category order", () => {
    const ranks = editor.Blocks.getAll().map((b: any) => categoryOrder.indexOf(catId(b)));
    expect(ranks.every((r: number) => r >= 0)).toBe(true);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  test("card presets compile to valid MJML", () => {
    ["mj-icon-text-right", "mj-icon-text-top"].forEach((id) => {
      const block = editor.Blocks.get(id) as any;
      expect(block).toBeTruthy();
      editor.setComponents(`<mjml><mj-body>${block.get("content")}</mj-body></mjml>`);
      expect(editor.getWrapper()!.findType("mj-icon-text")).toHaveLength(1);
      const { errors } = editor.Commands.run("mjml-code-to-html");
      expect(errors).toHaveLength(0);
    });
  });
});
