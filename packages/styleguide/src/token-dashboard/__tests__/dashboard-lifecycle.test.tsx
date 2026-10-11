// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { flushAll, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { expect, it, vi } from "vitest";
import { TokenDashboardMount } from "../token-dashboard-mount.js";

const adapter = vi.hoisted(() => {
  let resolve!: () => void;
  const ready = new Promise<void>((done) => { resolve = done; });
  return { ready, resolve, mount: vi.fn() };
});
vi.mock("../token-dashboard-adapter.js", async () => {
  await adapter.ready;
  return { mountDashboard: adapter.mount };
});
const manifest = { paletteColors: [], colorTokens: [], spacingTokens: [], fontTokens: [], sizeTokens: [] };

it("ignores the adapter import when its island was already disposed", async () => {
  const island = renderIsland(TokenDashboardMount, { manifest, tabs: [] });
  const host = island.container.querySelector("[data-sg-token-dashboard]")!;
  island.dispose();
  adapter.resolve();
  await import("../token-dashboard-adapter.js");
  await flushAll();
  expect(adapter.mount).not.toHaveBeenCalled();
  expect(host.childNodes).toHaveLength(0);
});

it("unmounts the opaque renderer while its DOM is still present", async () => {
  const unmount = vi.fn();
  adapter.mount.mockImplementation((host: HTMLElement) => {
    host.textContent = "Opaque widget";
    return () => {
      expect(host.textContent).toBe("Opaque widget");
      unmount();
    };
  });
  const island = renderIsland(TokenDashboardMount, { manifest, tabs: [] });
  const host = island.container.querySelector("[data-sg-token-dashboard]")!;
  await vi.waitFor(() => expect(adapter.mount).toHaveBeenCalledTimes(1));
  island.dispose();
  expect(unmount).toHaveBeenCalledTimes(1);
  expect(host.childNodes).toHaveLength(0);
});
