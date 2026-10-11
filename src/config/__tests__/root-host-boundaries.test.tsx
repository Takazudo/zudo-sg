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
    expect(listeners).toEqual(["zfb:before-preparation", "zfb:after-swap"]);
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
