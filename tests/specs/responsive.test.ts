import grapesjs, { Component, Editor } from "grapesjs";
import grapesJSMJML from "../../src";
import { cmdGetMjml, cmdGetMjmlToHtml } from "../../src/commands";
import {
  BREAKPOINTS_PROP,
  DEFAULT_BREAKPOINTS,
  getResponsive,
  normalizeBreakpoints,
  previewWidthFor,
  tierForWidth,
} from "../../src/responsive";
import { ResponsiveEntry, buildExportCss, buildPreviewCss, parseMeta, serializeMeta } from "../../src/responsive/css";

const TEMPLATE = `<mjml><mj-body><mj-section><mj-column>
  <mj-text font-size="14px" color="#111111">Hello</mj-text>
  <mj-button>Go</mj-button>
</mj-column></mj-section></mj-body></mjml>`;

describe("breakpoints", () => {
  test("normalize keeps tiers ascending and in range", () => {
    expect(normalizeBreakpoints(undefined)).toEqual(DEFAULT_BREAKPOINTS);
    expect(normalizeBreakpoints({ tablet: 600, desktop: 500 })).toEqual({ tablet: 600, desktop: 601 });
    expect(normalizeBreakpoints({ tablet: 10, desktop: "900" as any })).toEqual({ tablet: 240, desktop: 900 });
    expect(normalizeBreakpoints({ tablet: NaN })).toEqual(DEFAULT_BREAKPOINTS);
  });

  test("width → tier, and preview widths land inside their tier", () => {
    const bp = { tablet: 480, desktop: 768 };
    expect(tierForWidth(320, bp)).toBe("mobile");
    expect(tierForWidth(480, bp)).toBe("tablet");
    expect(tierForWidth(767, bp)).toBe("tablet");
    expect(tierForWidth(768, bp)).toBe("desktop");
    expect(tierForWidth(null, bp)).toBe("desktop");

    [bp, { tablet: 300, desktop: 400 }, { tablet: 700, desktop: 1200 }].forEach((b) => {
      expect(tierForWidth(previewWidthFor("mobile", b), b)).toBe("mobile");
      expect(tierForWidth(previewWidthFor("tablet", b), b)).toBe("tablet");
      expect(tierForWidth(previewWidthFor("desktop", b), b)).toBe("desktop");
    });
  });
});

describe("responsive css", () => {
  const entries: ResponsiveEntry[] = [
    {
      type: "mj-text",
      className: "mjr-c1",
      overrides: { tablet: { "font-size": "16px" }, desktop: { "font-size": "20px", align: "center" } },
    },
    { type: "mj-button", className: "mjr-c2", overrides: { desktop: { "background-color": "red" } } },
  ];

  test("export css has min-width media queries per tier with !important", () => {
    const css = buildExportCss(entries, { tablet: 500, desktop: 900 });
    expect(css).toContain("@media only screen and (min-width: 500px)");
    expect(css).toContain("@media only screen and (min-width: 900px)");
    expect(css).toContain(".mjr-c1 > div { font-size: 16px !important; }");
    expect(css).toContain(".mjr-c1 > div { font-size: 20px !important; text-align: center !important; }");
    expect(css).toContain(".mjr-c2 td[bgcolor], .mjr-c2 td > a, .mjr-c2 td > p { background-color: red !important; }");
  });

  test("export css is empty without overrides", () => {
    expect(buildExportCss([], DEFAULT_BREAKPOINTS)).toBe("");
  });

  test("unsupported attributes and unsafe values are dropped", () => {
    const css = buildExportCss(
      [{ type: "mj-text", className: "x", overrides: { tablet: { href: "#", color: "red;} body{x:y" } } }],
      DEFAULT_BREAKPOINTS,
    );
    const rules = css.slice(css.indexOf("*/") + 2);
    expect(rules).not.toContain("href");
    expect(rules).toContain(".x > div { color: red bodyx:y !important; }");
  });

  test("preview css cascades tiers without media queries", () => {
    expect(buildPreviewCss(entries, "mobile")).toBe("");
    const tablet = buildPreviewCss(entries, "tablet");
    expect(tablet).toContain("16px");
    expect(tablet).not.toContain("20px");
    expect(tablet).not.toContain("@media");
    const desktop = buildPreviewCss(entries, "desktop");
    expect(desktop.indexOf("16px")).toBeLessThan(desktop.indexOf("20px"));
  });

  test("meta round-trips, even with comment terminators in values", () => {
    const meta = {
      breakpoints: { tablet: 500, desktop: 900 },
      overrides: { "mjr-a": { tablet: { "font-family": "Evil */ Font" } } },
    };
    const css = `${serializeMeta(meta)}\n@media {}`;
    expect(css.indexOf("*/")).toBe(css.lastIndexOf("*/"));
    expect(parseMeta(css)).toEqual(meta);
    expect(parseMeta(".a{}")).toBeNull();
    expect(parseMeta("/* grapesjs-mjml:responsive {broken */")).toBeNull();
  });
});

describe("responsive editor", () => {
  let editor: Editor;
  const text = () => editor.getWrapper()!.findType("mj-text")[0] as Component;
  const sm = () => editor.StyleManager as any;
  const getMjml = (): string => editor.Commands.run(cmdGetMjml);
  const select = (cmp: Component) => {
    editor.select(cmp);
    sm().select(editor.getSelectedAll());
  };

  beforeEach((done) => {
    editor = grapesjs.init({
      container: "#gjs",
      plugins: [grapesJSMJML],
      components: TEMPLATE,
    });
    editor.getModel().loadOnStart();
    editor.on("change:readyLoad", () => done());
  });

  // Let debounced Style/Trait Manager updates run before tearing down.
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve));
    editor.destroy();
  });

  test("style manager writes the base tier on mobile", () => {
    getResponsive(editor).setTier("mobile");
    select(text());
    sm().addStyleTargets({ "font-size": "12px" }, {});
    expect(text().getAttributes()["font-size"]).toBe("12px");
    expect(text().get("responsive")).toBeUndefined();
  });

  test("style manager writes overrides on tablet/desktop, base stays intact", () => {
    const ctrl = getResponsive(editor);
    ctrl.setTier("desktop");
    select(text());
    sm().addStyleTargets({ "font-size": "24px" }, {});

    expect(text().getAttributes()["font-size"]).toBe("14px");
    expect(text().get("responsive")).toEqual({ desktop: { "font-size": "24px" } });
    // Outside the Style Manager, getStyle is the plain base style.
    expect(text().getStyle()["font-size"]).toBe("14px");
    // The Style Manager sees the override; base values show as inherited.
    select(text());
    const prop = sm().getProperty("typography", "font-size");
    expect(prop.getFullValue()).toBe("24px");
    const color = sm().getProperty("typography", "color");
    expect(color.hasValueParent()).toBe(true);

    // Clearing the property removes the override.
    prop.clear();
    expect(text().get("responsive")).toBeUndefined();
  });

  test("tablet values cascade into desktop as inherited", () => {
    const ctrl = getResponsive(editor);
    ctrl.setTier("tablet");
    select(text());
    sm().addStyleTargets({ color: "#ff0000" }, {});
    ctrl.setTier("desktop");
    select(text());
    expect(ctrl.withStyleManagerScope(() => text().getStyle())).toEqual({});
    expect(ctrl.inheritedStyle(text(), "desktop").color).toBe("#ff0000");
  });

  test("unsupported properties are hidden while editing a tier", () => {
    getResponsive(editor).setTier("tablet");
    select(text());
    expect(sm().getProperty("typography", "font-size").isVisible()).toBe(true);
    expect(sm().getProperty("dimension", "height").isVisible()).toBe(false);
  });

  test("export adds the class token and a generated mj-style", () => {
    text().set("responsive", { tablet: { "font-size": "18px" } });
    const mjml = getMjml();
    const token = `mjr-${text().cid}`;
    expect(mjml).toContain(`css-class="${token}"`);
    expect(mjml).toMatch(/<mjml><mj-head><mj-style>[\s\S]*grapesjs-mjml:responsive[\s\S]*<\/mj-style><\/mj-head>/);
    expect(mjml).toContain(`.${token} > div { font-size: 18px !important; }`);

    const { html, errors } = editor.Commands.run(cmdGetMjmlToHtml);
    expect(errors).toEqual([]);
    expect(html).toContain("min-width: 480px");
    expect(html).toContain(`class="${token}"`);
  });

  test("user css-class is kept next to the token", () => {
    text().addAttributes({ "css-class": "hero" });
    text().set("responsive", { desktop: { color: "red" } });
    expect(getMjml()).toContain(`css-class="hero mjr-${text().cid}"`);
  });

  test("MJML round-trip restores overrides and breakpoints", () => {
    getResponsive(editor).setBreakpoints({ tablet: 520, desktop: 1000 });
    text().set("responsive", { tablet: { "font-size": "18px" }, desktop: { "font-size": "22px" } });
    text().addAttributes({ "css-class": "hero" });
    const exported = getMjml();

    editor.setComponents(exported);
    const restored = text();
    expect(restored.get("responsive")).toEqual({ tablet: { "font-size": "18px" }, desktop: { "font-size": "22px" } });
    expect(restored.getAttributes()["css-class"]).toBe("hero");
    expect(getResponsive(editor).getBreakpoints()).toEqual({ tablet: 520, desktop: 1000 });
    // The generated block was absorbed, not duplicated.
    expect(editor.getWrapper()!.findType("mj-style")).toHaveLength(0);
    expect(getMjml().match(/grapesjs-mjml:responsive/g)).toHaveLength(1);
  });

  test("breakpoints move the preview devices and default to undefined", () => {
    const ctrl = getResponsive(editor);
    const root = ctrl.getRoot()!;
    ctrl.setBreakpoints({ tablet: 700, desktop: 1100 });
    expect(root.get(BREAKPOINTS_PROP)).toEqual({ tablet: 700, desktop: 1100 });
    expect(editor.Devices.get("tablet")!.get("width")).toBe("700px");
    ctrl.setBreakpoints(DEFAULT_BREAKPOINTS);
    expect(root.get(BREAKPOINTS_PROP)).toBeUndefined();
  });

  // Core clears its undo snapshot cache a tick after the (noUndo) frame
  // resize of a device switch, so wait before editing like a real user would.
  const switchTier = async (tier: any) => {
    getResponsive(editor).setTier(tier);
    await new Promise((resolve) => setTimeout(resolve));
    select(text());
    editor.UndoManager.clear();
  };

  test("overrides are undoable", async () => {
    await switchTier("desktop");
    sm().addStyleTargets({ color: "#00ff00" }, {});
    expect(text().get("responsive")).toEqual({ desktop: { color: "#00ff00" } });
    editor.UndoManager.undo();
    expect(text().get("responsive")).toBeFalsy();
    expect(text().getAttributes().color).toBe("#111111");
  });

  test("base edits stay undoable", async () => {
    await switchTier("mobile");
    sm().addStyleTargets({ color: "#00ff00" }, {});
    expect(text().getAttributes().color).toBe("#00ff00");
    editor.UndoManager.undo();
    expect(text().getAttributes().color).toBe("#111111");
  });
});
