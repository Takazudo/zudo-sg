// @vitest-environment node
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { renderSsr } from "../../packages/styleguide/src/__tests__/helpers/zudo-react.js";
import { createTokenDashboards } from "../../packages/styleguide/src/token-dashboard/create-token-dashboards.js";
import { TokenDashboardMount } from "../../packages/styleguide/src/token-dashboard/token-dashboard-mount.js";
import { buildUiTokenTabs, type UiDesignTokensManifest } from "../../packages/styleguide/src/token-dashboard/ui-token-tabs.js";
import { assertDashboardFallbacks } from "../verify-styleguide-install.mjs";

const document = new Window().document;

const manifest: UiDesignTokensManifest = {
  paletteColors: [], colorTokens: [], fontTokens: [], sizeTokens: [],
  spacingTokens: [{ id: "inline", cssVar: "--space-inline", label: "Inline", group: "inset", default: "1rem", step: 0.125, unit: "rem" }],
  groups: { spacing: [{ id: "inset", label: "Inset", preview: "bar" }] },
};

function serverMarkup() {
  const fragment = document.createElement("template");
  fragment.innerHTML = renderSsr(createTokenDashboards(manifest, buildUiTokenTabs(manifest)), {
    components: [TokenDashboardMount],
  });
  return fragment.content;
}

describe("packed /tokens truthful fallback verifier", () => {
  it("accepts real server output and retains foreign declared token data", () => {
    const dashboards = assertDashboardFallbacks(serverMarkup());
    expect(dashboards).toHaveLength(3);
    expect(dashboards[2].tabs[0].tiers[0].items[0]).toMatchObject({ cssVar: "--space-inline", default: "1rem" });
    expect(dashboards[2].manifest).toEqual(manifest);
  });

  it("rejects fabricated server dashboard rows", () => {
    const markup = serverMarkup();
    const fake = document.createElement("div");
    fake.setAttribute("data-css-var", "--space-inline");
    markup.append(fake);
    expect(() => assertDashboardFallbacks(markup)).toThrow(/fabricated client dashboard markup/);
  });

  it("rejects a missing dashboard loading shell", () => {
    const markup = serverMarkup();
    markup.querySelector('[data-zfb-island-skip-ssr="TokenDashboardMount"]')!.remove();
    expect(() => assertDashboardFallbacks(markup)).toThrow(/three TokenDashboardMount loading shells/);
  });

  it("rejects changed mode metadata and missing loading text", () => {
    const markup = serverMarkup();
    const shell = markup.querySelector('[data-zfb-island-skip-ssr="TokenDashboardMount"]')!;
    const props = JSON.parse(shell.getAttribute("data-props")!);
    props.mode = "dark";
    shell.setAttribute("data-props", JSON.stringify(props));
    expect(() => assertDashboardFallbacks(markup)).toThrow(/changed its serialized mode/);
    props.mode = "light";
    shell.setAttribute("data-props", JSON.stringify(props));
    shell.querySelector("p")!.remove();
    expect(() => assertDashboardFallbacks(markup)).toThrow(/lacks loading text/);
  });
});
