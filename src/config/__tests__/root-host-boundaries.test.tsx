import { afterEach, describe, expect, it } from "vitest";
import { renderSsr } from "@zudo-sg/demo-ui/src/test-utils/zudo-react";
import { AiChatModal } from "@takazudo/zudo-doc/ai-chat-modal";
import { ImageEnlarge } from "@takazudo/zudo-doc/image-enlarge";
import { MermaidEnlarge } from "@takazudo/zudo-doc/mermaid-enlarge";
import PreviewTokenPanelBootstrap from "@takazudo/zudo-sg/token-tweak/preview-token-panel-bootstrap";
import ClientRouterBootstrap from "../../components/client-router-bootstrap";
import { BodyEndIslands } from "../../../pages/lib/_body-end-islands";
import { settings } from "../settings";
import { runInNewContext } from "node:vm";
import { ensureNestedIslandPropsRefresh } from "@takazudo/zudo-doc/transitions";
import { swapFunctions } from "@takazudo/zfb-runtime/client-router";
import { SIDEBAR_RESIZER_INIT_SCRIPT } from "@takazudo/zudo-doc/sidebar-resizer";

const originalImageEnlarge = settings.imageEnlarge;
afterEach(() => { settings.imageEnlarge = originalImageEnlarge; });
const context = {
  components: [AiChatModal, ImageEnlarge, MermaidEnlarge, PreviewTokenPanelBootstrap, ClientRouterBootstrap],
  build: "root-body-test",
};

describe("root body-end server boundary", () => {
  it("keeps preview panel and client-router mounts with executable raw route scripts", () => {
    const html = renderSsr(<BodyEndIslands basePath="/" />, context);
    expect(html).toContain('data-zfb-island="PreviewTokenPanelBootstrap"');
    expect(html).toContain('data-zfb-island="ClientRouterBootstrap"');
    expect(html).toContain('data-zfb-build="root-body-test"');
    expect(html).toContain("__zdSidebarScrollRestoreInstalled");
    expect(html).toContain("toggle-preview-token-panel");
    expect(html).not.toContain("&quot;");
    const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]).find((source) => source.includes("__zdSidebarScrollRestoreInstalled"))!;
    const listeners: string[] = [];
    expect(() => runInNewContext(script, {
      window: {},
      document: { addEventListener: (event: string) => listeners.push(event) },
    })).not.toThrow();
    expect(listeners).toEqual(["zfb:before-swap", "zfb:after-swap", "zfb:before-preparation", "zfb:after-swap"]);
  });

  it("retains the real resizer and sidebar through the package's structure guard", async () => {
    const html = renderSsr(<BodyEndIslands basePath="/" />, context);
    const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]).find((source) => source.includes("__zdSidebarScrollRestoreInstalled"))!;
    for (const incompatible of [false, true]) {
      const live = document.implementation.createHTMLDocument();
      const incoming = document.implementation.createHTMLDocument();
      live.body.innerHTML = incoming.body.innerHTML = '<aside id="desktop-sidebar" style="position:fixed" data-zfb-transition-persist="sidebar-en-components"><div data-zfb-island="SidebarTree"></div></aside>';
      const aside = live.querySelector("aside")!;
      const handle = live.createElement("div");
      handle.setAttribute("data-sidebar-resizer", "");
      aside.append(handle);
      if (incompatible) aside.append(live.createElement("section"));
      runInNewContext(script, { window: {}, document: live, queueMicrotask, setTimeout, clearTimeout });
      runInNewContext(SIDEBAR_RESIZER_INIT_SCRIPT, { document: live, getComputedStyle });
      ensureNestedIslandPropsRefresh({ document: live });
      const event = new Event("zfb:before-swap");
      Object.assign(event, { newDocument: incoming, swap: () => {} });
      live.dispatchEvent(event);
      expect(incoming.querySelector("aside")!.getAttribute("data-zfb-transition-persist"))
        .toBe(incompatible ? null : "sidebar-en-components");
      swapFunctions.swapBodyElement(incoming.body, live.body);
      live.dispatchEvent(new Event("zfb:after-swap"));
      expect(live.querySelectorAll("[data-sidebar-resizer]")).toHaveLength(1);
      if (!incompatible) {
        expect(live.querySelector("aside")).toBe(aside);
        expect(aside.querySelector("[data-sidebar-resizer]")).toBe(handle);
      } else {
        expect(live.querySelector("[data-sidebar-resizer]")).not.toBe(handle);
        expect(live.querySelector("[data-sidebar-resizer]")!.getAttribute("role")).toBe("separator");
      }
      await Promise.resolve();
      expect(incoming.querySelector("[data-sg-sidebar-resizer-shape]")).toBeNull();
    }
  });

  it("honors the asset route forceImageEnlarge contract when the site feature is off", () => {
    settings.imageEnlarge = false;
    const ordinary = renderSsr(<BodyEndIslands basePath="/" />, context);
    expect(ordinary).not.toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    const asset = renderSsr(<BodyEndIslands basePath="/" forceImageEnlarge />, context);
    expect(asset).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(asset).toContain("zd-enlarge-dialog");
  });
});
