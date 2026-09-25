/**
 * Production bootstrap for the preview zdtp panel instance.
 *
 * zudo-doc's native bootstrap owns the lazy zdtp boundary (on-demand
 * `import()`, retry, persisted-state probe), so nothing here imports zdtp
 * eagerly. zdtp self-injects its stylesheet at mount time; no CSS import is
 * needed.
 */

import type { PanelConfig } from "@takazudo/zdtp";
import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
import { PREVIEW_TOKEN_PANEL_TOGGLE_EVENT } from "./preview-token-panel-config.js";
import { drainPreviewTokenPanelCapture } from "./preview-token-panel-capture.js";
import { watchPreviewTokenPanelLifecycle } from "./preview-token-panel-lifecycle.js";
import { drainPrehydrationToggle, installOwnerConsoleHelpers } from "./token-panel-native-bootstrap.js";

/** Id of the host's SSR pre-hydration toggle-capture `<script>`. */
export const PREVIEW_TOKEN_PANEL_PREHYDRATE_SCRIPT_ID = "zdtp-preview-prehydrate";

let bootstrapped = false;

export function bootstrapPreviewTokenPanel(getConfig: () => PanelConfig): void {
  if (typeof window === "undefined") return;
  if (!bootstrapped) {
    bootstrapped = true;
    watchPreviewTokenPanelLifecycle(getConfig);
    bootstrapDesignTokenPanel(getConfig);
    installOwnerConsoleHelpers(getConfig);
  }
  const capture = drainPreviewTokenPanelCapture();
  // Older hosts may still render the former script. Remove its listener and
  // pending state, but let the package capture own the replay when both ran.
  drainPrehydrationToggle(PREVIEW_TOKEN_PANEL_PREHYDRATE_SCRIPT_ID, PREVIEW_TOKEN_PANEL_TOGGLE_EVENT, !capture.installed);
  if (capture.pending % 2 === 1) {
    window.dispatchEvent(new CustomEvent(PREVIEW_TOKEN_PANEL_TOGGLE_EVENT));
  }
}
