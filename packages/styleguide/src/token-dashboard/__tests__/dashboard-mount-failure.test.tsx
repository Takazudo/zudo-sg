// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { afterEach, expect, it, vi } from "vitest";
import { TokenDashboardMount } from "../token-dashboard-mount.js";

const failure = vi.hoisted(() => new Error("Host is not empty"));
vi.mock("../token-dashboard-adapter.js", () => ({
  mountDashboard: (host: HTMLElement) => {
    host.append(document.createElement("section"));
    throw failure;
  },
}));
afterEach(() => { vi.restoreAllMocks(); });
const manifest = { paletteColors: [], colorTokens: [], spacingTokens: [], fontTokens: [], sizeTokens: [] };

it("replaces partial dashboard DOM with a distinct alert and logs the mount error", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const island = renderIsland(TokenDashboardMount, { manifest, tabs: [] });
  const host = island.container.querySelector<HTMLElement>("[data-sg-token-dashboard]")!;
  await vi.waitFor(() => expect(host.getAttribute("role")).toBe("alert"));
  expect(host.textContent).toBe("Unable to render the token dashboard. Reload to try again.");
  expect(host.childElementCount).toBe(0);
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("failed to mount"), failure);
  expect(() => island.dispose()).not.toThrow();
  expect(host.childNodes).toHaveLength(0);
});
