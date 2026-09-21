// Host data for the engine's preview token panel: the manifest-derived tab set
// re-exported by `@takazudo/zudo-sg/plugins/zdtp-apply-proxy`'s
// `virtual:zudo-sg-preview-token-panel` (`zdtpApplyProxy.tabsModule` option in
// zudo-sg.config.mjs). Without a tabs module the panel bootstrap short-circuits
// and the header trigger button opens nothing (see
// preview-token-panel-bootstrap.tsx).
import { buildUiTokenTabs } from "@takazudo/zudo-sg/token-dashboard";
import type { UiDesignTokensManifest } from "@takazudo/zudo-sg/token-dashboard";
import {
  UI_PALETTE_COLORS,
  UI_COLOR_TOKENS,
  UI_SPACING_TOKENS,
  UI_FONT_TOKENS,
  UI_SIZE_TOKENS,
} from "../styleguide/token-manifest.ts";

const uiDesignTokensManifest: UiDesignTokensManifest = {
  paletteColors: UI_PALETTE_COLORS,
  colorTokens: UI_COLOR_TOKENS,
  spacingTokens: UI_SPACING_TOKENS,
  fontTokens: UI_FONT_TOKENS,
  sizeTokens: UI_SIZE_TOKENS,
};

export const tabs = buildUiTokenTabs(uiDesignTokensManifest);
