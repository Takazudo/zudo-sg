import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { UI_DASHBOARD_PREVIEW_TEXT } from "@/config/ui-token-tabs";
import { UiTokenDashboards } from "../ui-token-dashboards";

function renderDashboards() {
  const html = render(<UiTokenDashboards />);
  const container = document.createElement("div");
  container.innerHTML = html;
  return { html, container };
}

describe("UI declared-defaults dashboards", () => {
  it("renders two isolated modes with the complete token inventory", () => {
    const { container } = renderDashboards();
    const dashboards = container.querySelectorAll(".zdtp-dashboard");
    expect(dashboards).toHaveLength(2);

    for (const [index, mode] of ["light", "dark"].entries()) {
      const dashboard = dashboards[index]!;
      expect(dashboard.id).toBe(`ui-defaults-${mode}`);
      expect(dashboard.getAttribute("data-mode")).toBe(mode);
      expect(dashboard.getAttribute("data-chrome")).toBe(mode);
      expect(dashboard.querySelector(".zdtp-dashboard__count")?.textContent).toBe(
        "102 tokens",
      );
      expect(dashboard.querySelectorAll("[data-css-var]")).toHaveLength(102);
      const background = dashboard.querySelector('[data-css-var="--color-bg"]');
      expect(background?.querySelector(".zdtp-dashboard__value")?.textContent).toMatch(
        /^light-dark\(/,
      );
      expect(
        dashboard.querySelector(
          '[data-css-var="--spacing-hsp-md"] .zdtp-dashboard__ruler',
        ),
      ).not.toBeNull();
      expect(dashboard.textContent).toContain(UI_DASHBOARD_PREVIEW_TEXT);
      expect(dashboard.textContent).toContain(
        "デザイントークンは、画面のリズムと読みやすさを支えます。",
      );
    }
  });

  it("emits static samples without diagnostics, global styles, or copy targets", () => {
    const { html, container } = renderDashboards();
    expect(container.querySelector("[data-diagnostic]")).toBeNull();
    expect(html).not.toContain("Ruler unavailable");
    expect(html).not.toContain("<style");
    expect(html).not.toContain(":root");
    expect(container.querySelector("[data-sg-token]")).toBeNull();
    expect(container.querySelector("button, input, textarea, select")).toBeNull();
  });
});
