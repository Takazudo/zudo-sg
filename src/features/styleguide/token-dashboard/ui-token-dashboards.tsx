/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { TokenDashboard } from "@takazudo/zdtp/dashboard";
import {
  uiDashboardTabs,
  dashboardPreviewOverrides,
  UI_DASHBOARD_PREVIEW_TEXT,
} from "@/config/ui-token-tabs";

/** Static declared values; kept outside the live playground's copy boundary. */
export function UiTokenDashboards() {
  return (
    <section class="mb-vsp-xl flex flex-col gap-vsp-lg">
      <div class="max-w-[56rem]">
        <h2 class="mb-vsp-2xs text-xl font-semibold text-fg">Declared defaults</h2>
        <p class="text-muted">
          These are the declared defaults of the <code>@zudo-sg/ui</code> tokens
          from the generated manifest of <code>packages/ui/styles/tokens.css</code>{" "}
          and <code>packages/ui/styles/colors.css</code>, shown per mode. Samples
          are isolated from the live panels and anything saved in them. Nothing
          here is clickable or editable.
        </p>
      </div>
      <TokenDashboard
        id="ui-defaults-light"
        mode="light"
        title="UI tokens — declared defaults (light)"
        tabs={uiDashboardTabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
      <TokenDashboard
        id="ui-defaults-dark"
        mode="dark"
        chrome="dark"
        title="UI tokens — declared defaults (dark)"
        tabs={uiDashboardTabs}
        previewOverrides={dashboardPreviewOverrides}
        previewText={UI_DASHBOARD_PREVIEW_TEXT}
      />
    </section>
  );
}
