/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { TabConfig } from "@takazudo/zdtp";
import { TokenDashboard } from "@takazudo/zdtp/dashboard";
import type { JSX } from "preact";
import { buildDashboardPreviewOverrides, UI_DASHBOARD_PREVIEW_TEXT } from "./ui-token-tabs.js";
import type { UiDesignTokensManifest } from "./ui-token-tabs.js";

export interface CreateTokenDashboardsOptions {
  /**
   * Inline CSS custom properties applied to the wrapping `<section>` — e.g. a
   * host's per-mode chrome colors (`--zdtp-dashboard-{light,dark}-{bg,fg}`)
   * resolved from its own color-scheme settings. Chrome-color resolution is
   * host-specific (site theme config), so this package never computes it
   * itself; omit to render without a chrome color override.
   */
  chromeStyle?: JSX.CSSProperties;
}

/**
 * Static declared values; kept outside the live playground's copy boundary.
 *
 * Takes the host's generated design-token manifest and the shared tab config
 * built from it (`buildUiTokenTabs(manifest)`, reused as-is from the host's
 * runtime preview panel so both stay in sync) as plain data props — this
 * component has no host import of its own.
 */
export function createTokenDashboards(
  manifest: UiDesignTokensManifest,
  tabs: readonly TabConfig[],
  options: CreateTokenDashboardsOptions = {},
): JSX.Element {
  const dashboardPreviewOverrides = buildDashboardPreviewOverrides(manifest);
  return (
    <section class="mb-vsp-xl flex flex-col gap-vsp-lg" style={options.chromeStyle}>
      <div class="max-w-[56rem]">
        <h2 class="mb-vsp-2xs text-xl font-semibold text-[color:var(--sg-fg)]">Declared defaults</h2>
        <p class="text-[color:var(--sg-muted)]">
          These are the declared defaults of the design-token manifest,
          shown as light, dark, and shared token references. The light and
          dark frames show only tokens whose declared value differs by mode
          (<code>light-dark()</code> pairs and rows that reference them); the
          shared frame lists every other token once and follows the site
          theme. Samples are isolated from the live panels and anything saved
          in them. Nothing here is clickable or editable.
        </p>
      </div>
      <TokenDashboard
        id="ui-defaults-light"
        mode="light"
        chrome="light"
        include="mode-dependent"
        title="UI tokens — mode-dependent defaults (light)"
        tabs={tabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
      <TokenDashboard
        id="ui-defaults-dark"
        mode="dark"
        chrome="dark"
        include="mode-dependent"
        title="UI tokens — mode-dependent defaults (dark)"
        tabs={tabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
      <TokenDashboard
        id="ui-defaults-shared"
        chrome="host"
        include="mode-independent"
        title="UI tokens — shared defaults (mode-independent)"
        tabs={tabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
    </section>
  );
}
