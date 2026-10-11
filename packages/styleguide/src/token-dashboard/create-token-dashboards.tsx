import type { TabConfig } from "@takazudo/zdtp";
import { Island } from "@takazudo/zfb";
import type { CSSProperties } from "@takazudo/zfb/zudo-react";
import { TokenDashboardMount } from "./token-dashboard-mount.js";
import { UI_DASHBOARD_PREVIEW_TEXT } from "./ui-token-tabs.js";
import type { UiDesignTokensManifest } from "./ui-token-tabs.js";

export interface CreateTokenDashboardsOptions {
  /**
   * Inline CSS custom properties applied to the wrapping `<section>` — e.g. a
   * host's per-mode chrome colors (`--zdtp-dashboard-{light,dark}-{bg,fg}`)
   * resolved from its own color-scheme settings. Chrome-color resolution is
   * host-specific (site theme config), so this package never computes it
   * itself; omit to render without a chrome color override.
   */
  chromeStyle?: CSSProperties | string;
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
) {
  const previewText = manifest.groups
    ? "Design tokens give an interface a shared rhythm across pages and themes. Compare the declared values, scale, color, and shape in these samples."
    : UI_DASHBOARD_PREVIEW_TEXT;
  return (
    <section class="mb-vsp-xl flex flex-col gap-vsp-lg" style={options.chromeStyle}>
      <div class="max-w-[56rem]">
        <h2 class="mb-vsp-2xs text-xl font-semibold text-sg-fg">Declared defaults</h2>
        <p class="text-sg-muted">
          These are the declared defaults of the design-token manifest,
          shown as light, dark, and shared token references. The light and
          dark frames show only tokens whose declared value differs by mode
          (<code>light-dark()</code> pairs and rows that reference them); the
          shared frame lists every other token once and follows the site
          theme. Samples are isolated from the live panels and anything saved
          in them. Nothing here is clickable or editable.
        </p>
      </div>
      {([
        { id: "ui-defaults-light", mode: "light", chrome: "light", include: "mode-dependent", title: "UI tokens — mode-dependent defaults (light)" },
        { id: "ui-defaults-dark", mode: "dark", chrome: "dark", include: "mode-dependent", title: "UI tokens — mode-dependent defaults (dark)" },
        { id: "ui-defaults-shared", chrome: "host", include: "mode-independent", title: "UI tokens — shared defaults (mode-independent)" },
      ] as const).map((dashboard) => (
        <Island when="load" ssrFallback={<div><h2>{dashboard.title}</h2><p>Loading declared defaults…</p></div>}>
          <TokenDashboardMount {...dashboard} tabs={tabs} manifest={manifest} previewText={previewText} />
        </Island>
      ))}
    </section>
  );
}
