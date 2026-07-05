/**
 * Production bootstrap for @takazudo/zdtp (zdtp).
 *
 * Imported as a side-effect from the body-end islands helper when
 * settings.designTokenPanel is truthy. The dynamic import is gated there so
 * this module is only bundled when the feature is enabled.
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
import { designTokenPanelConfig } from "@/config/design-token-panel-config";

configurePanel(designTokenPanelConfig);

// Drain the pre-hydration click queue. If the user clicked the palette button
// before this module evaluated, a pre-hydration shim captured the event as a
// single boolean flag. Calling __zdtpReadyClicks() here removes the shim
// listener and re-dispatches once (at most) so the now-registered zdtp
// listener picks it up and mounts the panel.
if (typeof window !== "undefined") {
  (window as { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks?.();

  // zdtp's root (non-Astro) entry point does not auto-install
  // `window[consoleNamespace]` helpers the way its Astro host-adapter does
  // (zdtp README §10) — that wiring lives in astro/host-adapter.ts, which this
  // project's zfb-based host doesn't use. Wire the owner-autoload pair (0.4.2)
  // by hand so `window.sgDoc.enableAutoload()` / `.disableAutoload()` work
  // from devtools, matching the documented console-API contract (which also
  // says the object should be MERGED into, not overwritten).
  const w = window as unknown as Record<string, Record<string, unknown> | undefined>;
  const ns = designTokenPanelConfig.consoleNamespace;
  w[ns] = {
    ...w[ns],
    enableAutoload: () => enableAutoload(designTokenPanelConfig),
    disableAutoload: () => disableAutoload(designTokenPanelConfig),
  };
}
