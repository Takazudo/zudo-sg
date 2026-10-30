// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { flushAll, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { expect, it, vi } from "vitest";
import { TokenDashboardMount } from "../token-dashboard-mount.js";

const adapter = vi.hoisted(() => {
  let reject!: (error: Error) => void;
  const ready = new Promise<void>((_, fail) => { reject = fail; });
  ready.catch(() => {});
  return { ready, reject };
});
vi.mock("../token-dashboard-adapter.js", async () => {
  await adapter.ready;
  return {};
});
const manifest = { paletteColors: [], colorTokens: [], spacingTokens: [], fontTokens: [], sizeTokens: [] };

it("neither renders nor logs an import failure that arrives after dispose", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const island = renderIsland(TokenDashboardMount, { manifest, tabs: [] });
  const host = island.container.querySelector("[data-sg-token-dashboard]")!;
  island.dispose();
  adapter.reject(new Error("Late failure"));
  await import("../token-dashboard-adapter.js").catch(() => {});
  await flushAll();
  expect(consoleError).not.toHaveBeenCalled();
  expect(host.getAttribute("role")).toBeNull();
  expect(host.childNodes).toHaveLength(0);
  consoleError.mockRestore();
});
