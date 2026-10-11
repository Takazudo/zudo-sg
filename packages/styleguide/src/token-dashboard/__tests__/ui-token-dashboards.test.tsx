// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { TokenDashboardMount } from "../token-dashboard-mount.js";
import { describe, expect, it, vi } from "vitest";
import { splitLightDark } from "@takazudo/zdtp/dashboard";
import { buildUiTokenTabs, UI_DASHBOARD_PREVIEW_TEXT } from "../ui-token-tabs.js";
import type { UiDesignTokensManifest } from "../ui-token-tabs.js";
import { createTokenDashboards } from "../create-token-dashboards.js";

/**
 * Small, self-contained manifest fixture (a curated subset of real
 * `@zudo-sg/demo-ui` token shapes) — the package must not import a host's
 * generated manifest, so this proves `createTokenDashboards` works from
 * plain data alone. Two `light-dark()` color tokens are mode-dependent;
 * everything else is mode-independent.
 */
const FIXTURE_MANIFEST: UiDesignTokensManifest = {
  paletteColors: [
    { name: "neutral-0", value: "oklch(0.970 0.006 75)" },
    { name: "neutral-3", value: "oklch(0.235 0.010 75)" },
    { name: "accent-1", value: "oklch(.700 .158 62)" },
  ],
  colorTokens: [
    {
      id: "ui-color-bg",
      cssVar: "--color-bg",
      label: "color-bg",
      group: "surface",
      default: "light-dark(var(--palette-neutral-0), var(--palette-neutral-3))",
      step: 1,
      unit: "",
      control: "text",
    },
    {
      id: "ui-color-fg",
      cssVar: "--color-fg",
      label: "color-fg",
      group: "text",
      default: "light-dark(var(--palette-neutral-3), var(--palette-neutral-0))",
      step: 1,
      unit: "",
      control: "text",
    },
    {
      // A literal (not var()-referencing) mode-independent color, to prove
      // mode-dependence isn't assigned to every color row indiscriminately.
      id: "ui-color-accent",
      cssVar: "--color-accent",
      label: "color-accent",
      group: "accent",
      default: "oklch(.700 .158 62)",
      step: 1,
      unit: "",
      control: "text",
    },
  ],
  spacingTokens: [
    {
      id: "ui-spacing-hsp-md",
      cssVar: "--spacing-hsp-md",
      label: "spacing-hsp-md",
      group: "hsp",
      default: "1rem",
      step: 0.25,
      unit: "rem",
    },
  ],
  fontTokens: [
    {
      id: "ui-text-base",
      cssVar: "--text-base",
      label: "text-base",
      group: "font-size",
      default: "1rem",
      step: 0.125,
      unit: "rem",
    },
  ],
  sizeTokens: [
    {
      id: "ui-radius-md",
      cssVar: "--radius-md",
      label: "radius-md",
      group: "radius",
      default: "0.5rem",
      step: 0.05,
      unit: "rem",
    },
    {
      id: "ui-shadow-card",
      cssVar: "--shadow-card",
      label: "shadow-card",
      group: "shadow",
      default: "0 0.5px 1px oklch(.185 .005 65 / 0.05)",
      step: 1,
      unit: "",
      control: "text",
    },
  ],
};

// Total rows rendered = 3 palette swatches + 3 color + 1 spacing + 1 font +
// 2 size = 10; only the two light-dark() color rows are mode-dependent.
const FIXTURE_TOKEN_COUNT = 10;
const FIXTURE_MODE_DEPENDENT_COUNT = 2;
const FIXTURE_MODE_INDEPENDENT_COUNT = 8;

function PopulatedDashboards() {
  const tabs = buildUiTokenTabs(FIXTURE_MANIFEST);
  return <>
    <TokenDashboardMount id="ui-defaults-light" title="Light defaults" mode="light" chrome="light" include="mode-dependent" tabs={tabs} manifest={FIXTURE_MANIFEST} previewText={UI_DASHBOARD_PREVIEW_TEXT} />
    <TokenDashboardMount id="ui-defaults-dark" title="Dark defaults" mode="dark" chrome="dark" include="mode-dependent" tabs={tabs} manifest={FIXTURE_MANIFEST} previewText={UI_DASHBOARD_PREVIEW_TEXT} />
    <TokenDashboardMount id="ui-defaults-shared" title="Shared defaults" chrome="host" include="mode-independent" tabs={tabs} manifest={FIXTURE_MANIFEST} previewText={UI_DASHBOARD_PREVIEW_TEXT} />
  </>;
}

async function renderDashboards() {
  const island = renderIsland(PopulatedDashboards, {});
  await vi.waitFor(() => expect(island.container.querySelectorAll("[data-css-var]")).toHaveLength(2 * FIXTURE_MODE_DEPENDENT_COUNT + FIXTURE_MODE_INDEPENDENT_COUNT));
  await island.flush();
  return { ...island, html: island.container.innerHTML };
}

describe("createTokenDashboards", () => {
  it("renders filtered mode-dependent and shared inventories", async () => {
    const { container } = await renderDashboards();
    const dashboards = container.querySelectorAll(".zdtp-dashboard");
    expect(dashboards).toHaveLength(3);

    const light = container.querySelector("#ui-defaults-light")!;
    const dark = container.querySelector("#ui-defaults-dark")!;
    const shared = container.querySelector("#ui-defaults-shared")!;
    expect(light.id).toBe("ui-defaults-light");
    expect(dark.id).toBe("ui-defaults-dark");
    expect(shared.id).toBe("ui-defaults-shared");
    expect(light.getAttribute("data-mode")).toBe("light");
    expect(dark.getAttribute("data-mode")).toBe("dark");
    expect(light.getAttribute("data-chrome")).toBe("light");
    expect(dark.getAttribute("data-chrome")).toBe("dark");
    expect(shared.getAttribute("data-chrome")).toBe("host");

    const namesOf = (dashboard: Element) =>
      [...dashboard.querySelectorAll("[data-css-var]")].map((row) =>
        row.getAttribute("data-css-var"),
      );
    const lightNames = namesOf(light);
    const darkNames = namesOf(dark);
    const sharedNames = namesOf(shared);
    expect(lightNames).toHaveLength(FIXTURE_MODE_DEPENDENT_COUNT);
    expect(darkNames).toHaveLength(FIXTURE_MODE_DEPENDENT_COUNT);
    expect(sharedNames).toHaveLength(FIXTURE_MODE_INDEPENDENT_COUNT);
    expect(new Set(lightNames)).toEqual(new Set(darkNames));
    const sharedNameSet = new Set(sharedNames);
    expect(lightNames.filter((name) => sharedNameSet.has(name))).toHaveLength(0);
    expect(new Set([...lightNames, ...sharedNames])).toHaveLength(FIXTURE_TOKEN_COUNT);

    expect(light.querySelector('[data-css-var="--color-bg"]')).not.toBeNull();
    expect(dark.querySelector('[data-css-var="--color-bg"]')).not.toBeNull();
    expect(shared.querySelector('[data-css-var="--color-bg"]')).toBeNull();
    const colorBg = FIXTURE_MANIFEST.colorTokens.find(
      (token) => token.cssVar === "--color-bg",
    );
    expect(colorBg).toBeDefined();
    const colorBgSides = splitLightDark(colorBg!.default);
    expect(colorBgSides).not.toBeNull();
    expect(
      light
        .querySelector('[data-css-var="--color-bg"] .zdtp-dashboard__value')
        ?.textContent,
    ).toBe(colorBgSides!.light);
    expect(
      dark
        .querySelector('[data-css-var="--color-bg"] .zdtp-dashboard__value')
        ?.textContent,
    ).toBe(colorBgSides!.dark);
    expect(
      light.querySelector('[data-css-var="--color-bg"] .zdtp-dashboard__value')
        ?.textContent,
    ).not.toMatch(/^light-dark\(/);
    expect(
      dark.querySelector('[data-css-var="--color-bg"] .zdtp-dashboard__value')
        ?.textContent,
    ).not.toMatch(/^light-dark\(/);

    expect(
      shared.querySelector('[data-css-var="--spacing-hsp-md"] .zdtp-dashboard__ruler'),
    ).not.toBeNull();
    expect(light.querySelector('[data-css-var="--spacing-hsp-md"]')).toBeNull();
    expect(dark.querySelector('[data-css-var="--spacing-hsp-md"]')).toBeNull();
    expect(shared.querySelector('[data-css-var="--spacing-hsp-md"] .zdtp-dashboard__value')?.textContent).toBe("1rem");
    expect(shared.querySelector('[data-css-var="--radius-md"] .zdtp-dashboard__value')?.textContent).toBe("0.5rem");
    expect(shared.textContent).toContain(UI_DASHBOARD_PREVIEW_TEXT);
    expect(shared.textContent).toContain(
      "デザイントークンは、画面のリズムと読みやすさを支えます。",
    );
  });

  it("emits static samples without diagnostics, global styles, or copy targets", async () => {
    const { html, container } = await renderDashboards();
    expect(container.querySelectorAll(".zdtp-dashboard")).toHaveLength(3);
    for (const dashboard of container.querySelectorAll(".zdtp-dashboard")) {
      expect(dashboard.querySelector("[data-diagnostic]")).toBeNull();
      expect(dashboard.textContent).not.toContain("Ruler unavailable");
    }
    expect(html).not.toContain("Ruler unavailable");
    expect(html).not.toContain("<style");
    expect(html).not.toContain(":root");
    expect(container.querySelector("[data-sg-token]")).toBeNull();
    expect(container.querySelector("button, input, textarea, select")).toBeNull();
  });

  it("unmounts the real populated widgets before clearing their hosts", async () => {
    const island = await renderDashboards();
    const hosts = [...island.container.querySelectorAll("[data-sg-token-dashboard]")];
    expect(hosts).toHaveLength(3);
    island.dispose();
    for (const host of hosts) expect(host.childNodes).toHaveLength(0);
  });

  it("applies the chromeStyle option to the wrapping section", () => {
    const tabs = buildUiTokenTabs(FIXTURE_MANIFEST);
    const html = renderSsr(
      createTokenDashboards(FIXTURE_MANIFEST, tabs, {
        chromeStyle: { "--zdtp-dashboard-light-bg": "oklch(1 0 0)" },
      }),
      { components: [TokenDashboardMount] },
    );
    expect(html).toContain("--zdtp-dashboard-light-bg");
    expect(html).toContain("Loading declared defaults");
    expect(html).toContain("UI tokens — shared defaults");
    expect(html).not.toContain("data-css-var");
    expect(html).not.toContain("zdtp-dashboard__");
    const shell = document.createElement("div");
    shell.innerHTML = html;
    const boundaries = [...shell.querySelectorAll('[data-zfb-island-skip-ssr="TokenDashboardMount"]')];
    expect(boundaries).toHaveLength(3);
    const props = boundaries.map((boundary) => JSON.parse(boundary.getAttribute("data-props")!));
    expect(props.map(({ id }) => id)).toEqual(["ui-defaults-light", "ui-defaults-dark", "ui-defaults-shared"]);
    expect(props.map(({ include }) => include)).toEqual(["mode-dependent", "mode-dependent", "mode-independent"]);
    expect(props.map(({ chrome }) => chrome)).toEqual(["light", "dark", "host"]);
    expect(props[0].tabs).toEqual(tabs);
    expect(props[0].manifest).toEqual(FIXTURE_MANIFEST);
    expect(props[2]).not.toHaveProperty("mode");
  });
});
