/**
 * Production bootstrap for @takazudo/zdtp (zdtp).
 *
 * Imported as a side-effect from the body-end islands helper when
 * settings.designTokenPanel is truthy. The dynamic import is gated there so
 * this module is only bundled when the feature is enabled.
 */

import { configurePanel } from "@takazudo/zdtp";
// CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in
// src/styles/global.css so the panel chrome lands in the main page CSS bundle
// (not a deferred chunk). Vite library mode strips the source CSS import from
// the emitted JS, so the explicit CSS-side import is the required pull point.
import { designTokenPanelConfig } from "@/config/design-token-panel-config";

configurePanel(designTokenPanelConfig);

// Drain the pre-hydration click queue. If the user clicked the palette button
// before this module evaluated, a pre-hydration shim captured the event as a
// single boolean flag. Calling __zdtpReadyClicks() here removes the shim
// listener and re-dispatches once (at most) so the now-registered zdtp
// listener picks it up and mounts the panel.
if (typeof window !== "undefined") {
  (window as { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks?.();
}

