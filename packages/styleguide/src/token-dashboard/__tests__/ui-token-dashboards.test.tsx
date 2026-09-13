// @vitest-environment happy-dom
import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
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

function renderDashboards() {
  const tabs = buildUiTokenTabs(FIXTURE_MANIFEST);
  const html = render(createTokenDashboards(FIXTURE_MANIFEST, tabs));
  const container = document.createElement("div");
  container.innerHTML = html;
  return { html, container };
}

describe("createTokenDashboards", () => {
  it("renders filtered mode-dependent and shared inventories", () => {
    const { container } = renderDashboards();
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
    expect(shared.textContent).toContain(UI_DASHBOARD_PREVIEW_TEXT);
    expect(shared.textContent).toContain(
      "デザイントークンは、画面のリズムと読みやすさを支えます。",
    );
  });

  it("emits static samples without diagnostics, global styles, or copy targets", () => {
    const { html, container } = renderDashboards();
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

  it("applies the chromeStyle option to the wrapping section", () => {
    const tabs = buildUiTokenTabs(FIXTURE_MANIFEST);
    const html = render(
      createTokenDashboards(FIXTURE_MANIFEST, tabs, {
        chromeStyle: { "--zdtp-dashboard-light-bg": "oklch(1 0 0)" },
      }),
    );
    expect(html).toContain("--zdtp-dashboard-light-bg");
  });
});
