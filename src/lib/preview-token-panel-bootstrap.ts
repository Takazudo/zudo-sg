/**
 * Production bootstrap for the preview (@zudo-sg/ui) zdtp panel instance.
 *
 * Mirrors `design-token-panel-bootstrap.ts` for the 2nd panel. Imported as a
 * side-effect from the body-end islands helper. The dynamic import is gated
 * there so this module is only bundled when needed.
 */

import {
  configurePanel,
  enableAutoload,
  disableAutoload,
} from "@takazudo/zdtp";
// zdtp 0.4.x self-injects its stylesheet at mount time (an inline <style>
// element written to <head> — see zdtp CHANGELOG 0.4.3 "Other Changes"). No
// consumer-side CSS import is required; global.css's former mid-file
// `@import "@takazudo/zdtp/styles.css"` was removed for #117.
import { previewTokenPanelConfig } from "@/config/preview-token-panel-config";

configurePanel(previewTokenPanelConfig);

// Drain the pre-hydration click queue for the PREVIEW panel's own shim.
// The body-end island injects a `__zdtpPreviewToggleShimInstalled` /
// `__zdtpPreviewReadyClicks` guard (distinct from the doc panel's
// `__zdtpToggleShimInstalled` / `__zdtpReadyClicks`) so the two shimss operate
// independently.
if (typeof window !== "undefined") {
  (window as { __zdtpPreviewReadyClicks?: () => void }).__zdtpPreviewReadyClicks?.();

  // See design-token-panel-bootstrap.ts's matching block: zdtp's root API
  // doesn't auto-install window[consoleNamespace] helpers for non-Astro
  // hosts, so the owner-autoload pair (0.4.2) is wired by hand here too —
  // `window.sgPreview.enableAutoload()` / `.disableAutoload()`.
  const w = window as unknown as Record<string, Record<string, unknown> | undefined>;
  const ns = previewTokenPanelConfig.consoleNamespace;
  w[ns] = {
    ...w[ns],
    enableAutoload: () => enableAutoload(previewTokenPanelConfig),
    disableAutoload: () => disableAutoload(previewTokenPanelConfig),
  };
}
