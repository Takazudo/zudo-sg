/**
 * Bootstrap module for @takazudo/zdtp in the styleguide package.
 *
 * Imported as a side-effect from the DesignTokenPanelBootstrap island.
 * Wires zdtp's navigation hooks to zfb's own navigation events via
 * setLifecycleAdapter() so zdtp re-applies persisted token overrides on
 * every soft navigation.
 */

import { configurePanel, setLifecycleAdapter, type LifecycleAdapter } from "@takazudo/zdtp";
// CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in
// styles/global.css — no CSS import here.
import { designTokenPanelConfig } from "@/config/design-token-panel-config";

configurePanel(designTokenPanelConfig);

// Drain the pre-hydration click queue.
if (typeof window !== "undefined") {
  (window as { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks?.();
}

if (typeof document !== "undefined") {
  const adapter: LifecycleAdapter = {
    onBeforeSwap(cb) {
      const handler = () => cb();
      document.addEventListener("zfb:before-preparation", handler);
      return () => document.removeEventListener("zfb:before-preparation", handler);
    },
    onPageLoad(cb) {
      const handler = () => cb();
      document.addEventListener("zfb:after-swap", handler);
      return () => document.removeEventListener("zfb:after-swap", handler);
    },
  };
  setLifecycleAdapter(adapter);
}
