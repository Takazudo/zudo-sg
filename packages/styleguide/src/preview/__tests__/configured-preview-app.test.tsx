// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { describe, expect, it, vi } from "vitest";
import { renderIsland } from "../../__tests__/helpers/zudo-react.js";
import ConfiguredPreviewApp from "../../routes/_preview-app.js";
const bridge = vi.hoisted(() => ({ cleanup: vi.fn(), install: vi.fn() }));
vi.mock("../../token-tweak/index.js", () => ({
  installIframeReceiver: (target: Window) => {
    bridge.install(target);
    return bridge.cleanup;
  },
}));
vi.mock("../../routes/_registry.js", () => ({
  storyRegistry: { getStoryBySlug: () => undefined },
}));
describe("ConfiguredPreviewApp", () => {
  it("keeps the registry in-bundle and installs/disposes the receiver once per navigation", async () => {
    bridge.install.mockClear();
    bridge.cleanup.mockClear();
    for (let i = 0; i < 2; i++) {
      const app = renderIsland(ConfiguredPreviewApp, {});
      await app.flush();
      expect(app.html).toContain('data-props="{}"');
      expect(bridge.install).toHaveBeenCalledTimes(i + 1);
      expect(bridge.install).toHaveBeenLastCalledWith(window);
      app.dispose();
      expect(bridge.cleanup).toHaveBeenCalledTimes(i + 1);
    }
  });
});
