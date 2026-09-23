// @vitest-environment happy-dom
import { render } from "preact-render-to-string";
import { assertValidPanelConfig, configurePanel, showDesignTokenPanel } from "@takazudo/zdtp";
import { describe, expect, it, vi } from "vitest";
import { buildUiTokenTabs } from "../ui-token-tabs.js";
import { createTokenDashboards } from "../create-token-dashboards.js";
import { createPreviewTokenPanelConfig } from "../../token-tweak/preview-token-panel-config.js";
import type { UiDesignTokensManifest } from "../ui-token-tabs.js";

const host: UiDesignTokensManifest = {
  paletteColors: [
    { name: "brand-100", cssVar: "--brand-100", id: "brand-100", label: "Brand pale", group: "brand", value: "oklch(0.94 0.08 45)" },
    { name: "brand-500", cssVar: "--brand-500", id: "brand-500", label: "Brand strong", group: "brand", value: "oklch(0.56 0.18 45)", readonly: true },
    { name: "signal-calm", cssVar: "--signal-calm", id: "signal-calm", label: "Calm", group: "signals", value: "oklch(0.7 0.12 205)" },
    { name: "status-alert", cssVar: "--status-alert", id: "status-alert", label: "Alert", group: "signals", value: "oklch(0.58 0.2 25)" },
  ],
  colorTokens: [{ id: "surface-canvas", cssVar: "--surface-canvas", label: "Canvas", group: "surface", default: "light-dark(var(--brand-100), var(--brand-500))", control: "text", step: 1, unit: "" }],
  spacingTokens: [{ id: "space-inline", cssVar: "--space-inline", label: "Inline", group: "inset", default: "1rem", step: 0.125, unit: "rem", units: ["rem", "px"] }],
  fontTokens: [
    { id: "type-body", cssVar: "--type-body", label: "Body", group: "type-size", default: "1.125rem", step: 0.125, unit: "rem" },
    { id: "type-leading", cssVar: "--type-leading", label: "Leading", group: "leading", default: "1.5", step: 0.1, unit: "", valueKind: "number" },
    { id: "type-weight", cssVar: "--type-weight", label: "Weight", group: "weight", default: "550", step: 1, unit: "", control: "select", options: ["350", "550", "750"] },
  ],
  sizeTokens: [{ id: "corner-card", cssVar: "--corner-card", label: "Card", group: "corners", default: "0.75rem", step: 0.125, unit: "rem" }],
  groups: {
    palette: [{ id: "brand", label: "Brand" }, { id: "signals", label: "Signals" }],
    color: [{ id: "surface", label: "Surfaces" }],
    spacing: [{ id: "inset", label: "Inset", preview: "bar" }],
    font: [{ id: "type-size", label: "Type size", preview: "size" }, { id: "leading", label: "Leading", preview: "line-height", previewBase: "--type-body" }, { id: "weight", label: "Weight", preview: "weight" }],
    size: [{ id: "corners", label: "Corners", preview: "radius" }],
  },
};

describe("foreign host token consumers", () => {
  it("renders the real panel controls for host palette and select rows", async () => {
    const tabs = buildUiTokenTabs(host);
    configurePanel(createPreviewTokenPanelConfig({ tabs }));
    showDesignTokenPanel();
    await vi.waitFor(() => expect(document.body.textContent).toContain("Brand pale"));
    expect(document.body.textContent).toContain("Brand strong");
    expect(document.body.textContent).toContain("Signals");
    expect(document.body.textContent).toContain("Alert");
    const tabButtons = [...document.querySelectorAll<HTMLElement>("[role=tab]")];
    expect(tabButtons.some((button) => button.textContent?.includes("Font"))).toBe(true);
    tabButtons.find((button) => button.textContent?.trim() === "Font")?.click();
    await vi.waitFor(() => expect(document.body.textContent).toContain("Weight"));
    expect([...document.querySelectorAll("select option")].map((option) => option.textContent)).toEqual(expect.arrayContaining(["350", "550", "750"]));
  });

  it("validates panel tabs and renders only host rows in the dashboard", () => {
    const tabs = buildUiTokenTabs(host);
    expect(() => assertValidPanelConfig(createPreviewTokenPanelConfig({ tabs }))).not.toThrow();
    expect(tabs[1]?.tiers.map((tier) => tier.label)).toEqual(["Brand", "Signals"]);
    expect(tabs[2]?.tiers[0]?.items[0]?.type).toEqual({ kind: "length", step: 0.125, unit: "rem", units: ["rem", "px"] });
    expect(tabs[3]?.tiers[1]?.items[0]?.type.kind).toBe("number");
    expect(tabs[3]?.tiers[2]?.items[0]?.type).toEqual({ kind: "select", options: ["350", "550", "750"] });
    const html = render(createTokenDashboards(host, tabs));
    for (const cssVar of ["--brand-100", "--brand-500", "--signal-calm", "--status-alert", "--surface-canvas", "--space-inline", "--type-body", "--type-leading", "--type-weight", "--corner-card"]) {
      expect(html).toContain(`data-css-var="${cssVar}"`);
    }
    expect(html).not.toContain('data-css-var="--palette-');
    expect(html).not.toContain('data-css-var="--text-base"');
    expect(html).not.toContain("102 entries");
  });
});
