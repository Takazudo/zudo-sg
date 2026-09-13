/**
 * Host adapter for the shared UI token tab data.
 *
 * Tab-shaping logic (building zdtp `TabConfig`s from a design-token
 * manifest, and the dashboard preview-kind overrides) now lives in the
 * engine package (`@takazudo/zudo-sg/token-dashboard`) — see
 * `packages/styleguide/src/token-dashboard/ui-token-tabs.ts` — so it can be
 * reused by any host, not just this one. This module only assembles this
 * project's generated manifest into the shape that package expects
 * (`UiDesignTokensManifest`) and builds the tabs array ONCE, so the runtime
 * preview panel (`preview-token-panel-config.ts`) and the static token
 * dashboard (rendered via `@takazudo/zudo-sg/token-dashboard`'s
 * `createTokenDashboards` on the engine's `/tokens` route) share the identical tab
 * identities, ordering, defaults, and preview metadata.
 */

import {
  buildUiTokenTabs,
  buildDashboardPreviewOverrides,
  UI_DASHBOARD_PREVIEW_TEXT,
} from "@takazudo/zudo-sg/token-dashboard";
import type { UiDesignTokensManifest } from "@takazudo/zudo-sg/token-dashboard";
import {
  UI_PALETTE_COLORS,
  UI_COLOR_TOKENS,
  UI_SPACING_TOKENS,
  UI_FONT_TOKENS,
  UI_SIZE_TOKENS,
} from "./ui-design-tokens-manifest.ts";

export const uiDesignTokensManifest: UiDesignTokensManifest = {
  paletteColors: UI_PALETTE_COLORS,
  colorTokens: UI_COLOR_TOKENS,
  spacingTokens: UI_SPACING_TOKENS,
  fontTokens: UI_FONT_TOKENS,
  sizeTokens: UI_SIZE_TOKENS,
};

export const uiTokenTabs = buildUiTokenTabs(uiDesignTokensManifest);

/** #586 restored the font previews, so the dashboard can use the same array. */
export const uiDashboardTabs = uiTokenTabs;

/**
 * Explicit dashboard samples for manifest rows whose editor kind cannot
 * describe the desired read-only sample. `createTokenDashboards` derives the
 * same overrides internally from the manifest it is given, so this export
 * exists only for callers (and tests) that want to inspect them directly.
 */
export const dashboardPreviewOverrides = buildDashboardPreviewOverrides(uiDesignTokensManifest);

export { UI_DASHBOARD_PREVIEW_TEXT };
