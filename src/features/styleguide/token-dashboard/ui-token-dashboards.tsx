/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { TokenDashboard } from "@takazudo/zdtp/dashboard";
import { colorSchemes } from "@/config/color-schemes";
import { resolveRampRef } from "@/config/color-scheme-utils";
import { settings } from "@/config/settings";
import {
  uiDashboardTabs,
  dashboardPreviewOverrides,
  UI_DASHBOARD_PREVIEW_TEXT,
} from "@/config/ui-token-tabs";

/** Static declared values; kept outside the live playground's copy boundary. */
export function UiTokenDashboards() {
  const chromeColors = Object.fromEntries(
    (["light", "dark"] as const).flatMap((mode) => {
      const schemeName = settings.colorMode
        ? settings.colorMode[`${mode}Scheme`]
        : settings.colorScheme;
      const scheme = colorSchemes[schemeName]!;
      return (["bg", "fg"] as const).map((role) => [
        `--zdtp-dashboard-${mode}-${role}`,
        resolveRampRef(scheme.map[role], scheme.ramps),
      ]);
    }),
  );
  return (
    <section class="mb-vsp-xl flex flex-col gap-vsp-lg" style={chromeColors}>
      <div class="max-w-[56rem]">
        <h2 class="mb-vsp-2xs text-xl font-semibold text-fg">Declared defaults</h2>
        <p class="text-muted">
          These are the declared defaults of the <code>@zudo-sg/ui</code> tokens
          from the generated manifest of <code>packages/ui/styles/tokens.css</code>{" "}
          and <code>packages/ui/styles/colors.css</code>. The light and dark frames
          show only tokens whose declared value differs by mode (<code>light-dark()</code>{" "}
          pairs and rows that reference them); the shared frame lists every other
          token once and follows the site theme. Samples are isolated from the live
          panels and anything saved in them. Nothing here is clickable or editable.
        </p>
      </div>
      <TokenDashboard
        id="ui-defaults-light"
        mode="light"
        chrome="light"
        include="mode-dependent"
        title="UI tokens — mode-dependent defaults (light)"
        tabs={uiDashboardTabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
      <TokenDashboard
        id="ui-defaults-dark"
        mode="dark"
        chrome="dark"
        include="mode-dependent"
        title="UI tokens — mode-dependent defaults (dark)"
        tabs={uiDashboardTabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
      <TokenDashboard
        id="ui-defaults-shared"
        chrome="host"
        include="mode-independent"
        title="UI tokens — shared defaults (mode-independent)"
        tabs={uiDashboardTabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
    </section>
  );
}
