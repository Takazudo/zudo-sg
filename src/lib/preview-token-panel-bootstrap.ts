/**
 * Production bootstrap for the preview (@zudo-sg/ui) zdtp panel instance.
 *
 * Mirrors `design-token-panel-bootstrap.ts` for the 2nd panel. Imported as a
 * side-effect from the body-end islands helper. The dynamic import is gated
 * there so this module is only bundled when needed.
 */

import { configurePanel } from "@takazudo/zdtp";
// CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in
// src/styles/global.css so the panel chrome lands in the main page CSS bundle
// (not a deferred chunk). Vite library mode strips the source CSS import from
// the emitted JS, so the explicit CSS-side import is the required pull point.
import { previewTokenPanelConfig } from "@/config/preview-token-panel-config";

configurePanel(previewTokenPanelConfig);

// Drain the pre-hydration click queue for the PREVIEW panel's own shim.
// The body-end island injects a `__zdtpPreviewToggleShimInstalled` /
// `__zdtpPreviewReadyClicks` guard (distinct from the doc panel's
// `__zdtpToggleShimInstalled` / `__zdtpReadyClicks`) so the two shimss operate
// independently.
if (typeof window !== "undefined") {
  (window as { __zdtpPreviewReadyClicks?: () => void }).__zdtpPreviewReadyClicks?.();
}
