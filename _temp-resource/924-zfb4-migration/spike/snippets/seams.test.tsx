import { describe, it, expect, vi } from "vitest";
import { createIslandTest, withIslandTestContext } from "@takazudo/zfb/zudo-react/testing";
import { renderToString } from "@takazudo/zfb/zudo-react/server";
import { Island } from "@takazudo/zfb";
import { Counter } from "./Counter";
import { Dashboard } from "./Dashboard";

describe("packed stack seams", () => {
  it("SSR → hydrate → click → flush → dispose", async () => {
    const t = createIslandTest(Counter, {}, { document });
    expect(t.html).toContain("spike-counter");
    expect(t.hydrate()).not.toBeNull();
    t.host.querySelector("button")!.click(); await t.flush();
    expect(t.host.textContent).toBe("1"); expect(t.diagnostics).toEqual([]);
    t.dispose(); expect(t.host.isConnected).toBe(false);
  });
  it("mount mode", async () => {
    const t = createIslandTest(Counter, {}, { document });
    expect(t.mount()).not.toBeNull(); t.host.querySelector("button")!.click(); await t.flush();
    expect(t.host.textContent).toBe("1"); t.dispose();
  });
  it("diagnoses deliberate mismatch", () => {
    const t = createIslandTest(Counter, {}, { document });
    t.host.querySelector("button")!.textContent = "wrong";
    t.hydrate(); console.log("mismatch diagnostics", JSON.stringify(t.diagnostics));
    expect(t.diagnostics.length).toBeGreaterThan(0); t.dispose();
  });
  it("withIslandTestContext supplies full-page scanner metadata", () => {
    const html = withIslandTestContext({ components: [Counter], build: "spike" }, () => renderToString(<Island when="load"><Counter /></Island>));
    expect(html).toContain("data-zfb-island"); console.log("full page island", html);
  });
  it("mounts zdtp inside activated zudo-react scope without host preact", async () => {
    const t = createIslandTest(Dashboard, {}, { document });
    expect(t.hydrate()).not.toBeNull();
    await vi.waitFor(() => expect(t.host.textContent).toContain("Spike Dashboard"));
    expect(t.diagnostics).toEqual([]); console.log("dashboard mounted", t.host.innerHTML.slice(0,350));
    t.dispose();
  });
  it("retains opaque panel bootstrap", async () => {
    const zdtp = await import("@takazudo/zdtp");
    const { bootstrapDesignTokenPanel } = await import("@takazudo/zudo-doc/design-token-panel-bootstrap");
    const { buildDesignTokenPanelConfig } = await import("@takazudo/zudo-doc/design-token-panel-config");
    expect(typeof zdtp.configurePanel).toBe("function");
    const build = (mode: "light" | "dark") => ({ ...buildDesignTokenPanelConfig(mode), consoleNamespace: "spikeOpaque" });
    bootstrapDesignTokenPanel(build);
    window.dispatchEvent(new CustomEvent("toggle-design-token-panel"));
    await vi.waitFor(() => expect(zdtp.__panelConfigForTest().consoleNamespace).toBe("spikeOpaque"));
    expect(document.getElementById("tokenpanel-highlight-mount")).not.toBeNull();
    console.log("opaque bootstrap configured", zdtp.__panelConfigForTest().consoleNamespace, document.body.innerHTML.slice(-350));
    zdtp.hideDesignTokenPanel();
  });
});
