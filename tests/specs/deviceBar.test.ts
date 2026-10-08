import grapesjs, { Editor } from "grapesjs";
import grapesJSMJML from "../../src";
import { CANVAS_WIDTH_KEY } from "../../src/canvasResize";
import { DeviceBar, WIDTH_PRESETS, createDeviceBar } from "../../src/deviceBar";
import { getResponsive } from "../../src/responsive";

describe("device bar", () => {
  let editor: Editor;
  let bar: DeviceBar;

  beforeEach((done) => {
    editor = grapesjs.init({ container: "#gjs", plugins: [grapesJSMJML] });
    editor.getModel().loadOnStart();
    editor.on("change:readyLoad", () => {
      editor.setComponents(`<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>`);
      bar = createDeviceBar(editor, { canvasResize: { max: 1600 } } as any);
      document.body.appendChild(bar.el);
      done();
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve));
    bar.destroy();
    editor.destroy();
    global.localStorage.removeItem(CANVAS_WIDTH_KEY);
  });

  const tierBtn = (tier: string) => bar.el.querySelector(`.mjd-tier[data-tier="${tier}"]`) as HTMLButtonElement;
  const checked = () =>
    Array.from(bar.el.querySelectorAll('.mjd-tier[aria-checked="true"]')).map((b) => b.getAttribute("data-tier"));
  const input = () => bar.el.querySelector(".mjd-width") as HTMLInputElement;

  test("renders one switch per tier and highlights the current one", () => {
    expect(bar.el.querySelectorAll(".mjd-tier")).toHaveLength(3);
    expect(checked()).toEqual([getResponsive(editor).getTier()]);
  });

  test("clicking a tier switches the canvas device and the edited tier", () => {
    tierBtn("desktop").click();
    expect(getResponsive(editor).getTier()).toBe("desktop");
    expect(checked()).toEqual(["desktop"]);
    tierBtn("tablet").click();
    expect(getResponsive(editor).getTier()).toBe("tablet");
    expect(checked()).toEqual(["tablet"]);
  });

  test("typing a width sets a custom canvas width and follows its tier", () => {
    input().value = "900";
    input().dispatchEvent(new Event("change"));
    expect(editor.Devices.getSelected()?.get("width")).toBe("900px");
    expect(checked()).toEqual(["desktop"]);
    input().value = "500";
    input().dispatchEvent(new Event("change"));
    expect(checked()).toEqual(["tablet"]);
    expect(input().value).toBe("500");
  });

  test("arrow keys nudge the width", () => {
    input().value = "600";
    input().dispatchEvent(new Event("change"));
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", shiftKey: true }));
    expect(editor.Devices.getSelected()?.get("width")).toBe("610px");
  });

  test("presets menu sets the width and marks the current preset", () => {
    (bar.el.querySelector('.mjd-icon-btn[aria-haspopup="menu"]') as HTMLButtonElement).click();
    const presets = Array.from(document.querySelectorAll(".mjd-preset")) as HTMLButtonElement[];
    expect(presets).toHaveLength(WIDTH_PRESETS.length);
    const email = presets.find((b) => b.dataset.width === "600")!;
    email.click();
    expect(editor.Devices.getSelected()?.get("width")).toBe("600px");
    expect(email.getAttribute("aria-current")).toBe("true");
    // Menu closed after picking.
    expect((document.querySelector(".mjd-pop[role=menu]") as HTMLElement).hidden).toBe(true);
  });

  test("breakpoints popover hosts the breakpoint editor", () => {
    const btn = bar.el.querySelector(".mjd-bp-btn") as HTMLButtonElement;
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    const pop = document.querySelector(".mjd-pop-bp") as HTMLElement;
    expect(pop.hidden).toBe(false);
    expect(pop.querySelectorAll(".mjr-handle")).toHaveLength(2);
    // Escape closes it.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(pop.hidden).toBe(true);
  });

  test("tiers with overrides on the selected component get a dot", () => {
    const text = editor.getWrapper()!.findType("mj-text")[0];
    text.set("responsive", { desktop: { "font-size": "20px" } });
    editor.select(text);
    bar.render();
    expect(tierBtn("desktop").hasAttribute("data-overridden")).toBe(true);
    expect(tierBtn("tablet").hasAttribute("data-overridden")).toBe(false);
  });
});
