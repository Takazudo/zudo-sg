// @vitest-environment happy-dom
import "../../packages/styleguide/src/__tests__/dom-test-setup.js";
import { renderIsland } from "../../packages/styleguide/src/__tests__/helpers/zudo-react.js";
import { previewTokenPanelCaptureScript } from "../../packages/styleguide/src/token-tweak/preview-token-panel-capture.js";
import { afterEach, expect, it, vi } from "vitest";
import EngineRoutePreviewTokenPanelBootstrap from "../../fixtures/engine-host/pages/lib/_engine-route-preview-token-panel-bootstrap.js";

const bootstrap = vi.hoisted(() => ({ native: vi.fn(), toggle: vi.fn() }));
vi.mock("@takazudo/zudo-doc/design-token-panel-bootstrap", () => ({ bootstrapDesignTokenPanel: bootstrap.native }));
vi.mock("virtual:zudo-sg-preview-token-panel", () => ({ tabs: [], applyEndpoint: undefined, applyRouting: undefined }));

type CaptureWindow = Window & { __sgPreviewTokenPanelCapture?: { ready: boolean; listener: EventListener } };
afterEach(() => {
  document.querySelectorAll("[data-sg-engine-route]").forEach((node) => node.remove());
  const capture = (window as CaptureWindow).__sgPreviewTokenPanelCapture;
  if (capture) window.removeEventListener("toggle-preview-token-panel", capture.listener);
  delete (window as CaptureWindow).__sgPreviewTokenPanelCapture;
  window.removeEventListener("toggle-preview-token-panel", bootstrap.toggle);
  delete (window as unknown as Record<string, unknown>).sgPreview;
  vi.clearAllMocks();
});

it("hydrates server-empty route gating, then marks the real bootstrap ready and replays an early toggle", async () => {
  new Function("window", previewTokenPanelCaptureScript())(window);
  window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"));
  bootstrap.native.mockImplementation(() => window.addEventListener("toggle-preview-token-panel", bootstrap.toggle));
  const island = renderIsland(EngineRoutePreviewTokenPanelBootstrap, {}, {
    beforeActivate() {
      expect(bootstrap.native).not.toHaveBeenCalled();
      const marker = document.createElement("div");
      marker.setAttribute("data-sg-engine-route", "");
      document.body.append(marker);
    },
  });
  await island.flush();
  expect(bootstrap.native).toHaveBeenCalledTimes(1);
  expect((window as CaptureWindow).__sgPreviewTokenPanelCapture?.ready).toBe(true);
  expect(bootstrap.toggle).toHaveBeenCalledTimes(1);
  expect(island.diagnostics).toEqual([]);
  await island.flush();
  expect(bootstrap.native).toHaveBeenCalledTimes(1);
  island.dispose();
});

it("hydrates on a host route without activating the engine-only bootstrap", async () => {
  new Function("window", previewTokenPanelCaptureScript())(window);
  const island = renderIsland(EngineRoutePreviewTokenPanelBootstrap, {});
  await island.flush();
  expect(bootstrap.native).not.toHaveBeenCalled();
  expect((window as CaptureWindow).__sgPreviewTokenPanelCapture?.ready).toBe(false);
  expect(island.diagnostics).toEqual([]);
  island.dispose();
});
