// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { expect, it, vi } from "vitest";
import { TokenDashboardMount } from "../token-dashboard-mount.js";

vi.mock("../token-dashboard-adapter.js", () => { throw new Error("Unavailable adapter"); });
it("shows a visible failure when the dashboard adapter cannot load", async () => {
  const manifest = { paletteColors: [], colorTokens: [], spacingTokens: [], fontTokens: [], sizeTokens: [] };
  const island = renderIsland(TokenDashboardMount, { manifest, tabs: [] });
  await vi.waitFor(() => expect(island.container.querySelector('[role="alert"]')?.textContent).toContain("Unable to load declared token defaults"));
  await island.flush();
  island.dispose();
});
