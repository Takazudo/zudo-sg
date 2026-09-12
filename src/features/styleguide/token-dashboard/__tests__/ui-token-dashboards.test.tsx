import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { splitLightDark } from "@takazudo/zdtp/dashboard";
import { UI_DASHBOARD_PREVIEW_TEXT } from "@/config/ui-token-tabs";
import { UI_COLOR_TOKENS } from "@/config/ui-design-tokens-manifest";
import {
  UI_DASHBOARD_MODE_DEPENDENT_COUNT,
  UI_DASHBOARD_MODE_INDEPENDENT_COUNT,
  UI_DASHBOARD_TOKEN_COUNT,
} from "../dashboard-inventory";
import { UiTokenDashboards } from "../ui-token-dashboards";

function renderDashboards() {
  const html = render(<UiTokenDashboards />);
  const container = document.createElement("div");
  container.innerHTML = html;
  return { html, container };
}

describe("UI declared-defaults dashboards", () => {
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
    expect(lightNames).toHaveLength(UI_DASHBOARD_MODE_DEPENDENT_COUNT);
    expect(darkNames).toHaveLength(UI_DASHBOARD_MODE_DEPENDENT_COUNT);
    expect(sharedNames).toHaveLength(UI_DASHBOARD_MODE_INDEPENDENT_COUNT);
    expect(new Set(lightNames)).toEqual(new Set(darkNames));
    const sharedNameSet = new Set(sharedNames);
    expect(lightNames.filter((name) => sharedNameSet.has(name))).toHaveLength(0);
    expect(new Set([...lightNames, ...sharedNames])).toHaveLength(
      UI_DASHBOARD_TOKEN_COUNT,
    );

    expect(light.querySelector('[data-css-var="--color-bg"]')).not.toBeNull();
    expect(dark.querySelector('[data-css-var="--color-bg"]')).not.toBeNull();
    expect(shared.querySelector('[data-css-var="--color-bg"]')).toBeNull();
    const colorBg = UI_COLOR_TOKENS.find((token) => token.cssVar === "--color-bg");
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
});
