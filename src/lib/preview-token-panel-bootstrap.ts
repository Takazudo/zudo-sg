/**
 * Production bootstrap for the preview (@zudo-sg/ui) zdtp panel instance.
 *
 * Mirrors `design-token-panel-bootstrap.ts` for the second panel. The module
 * stays on the scanner-visible island chain, while zudo-doc's native bootstrap
 * keeps the zdtp implementation behind its on-demand import.
 */

import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
// zdtp 0.4.x self-injects its stylesheet at mount time (an inline <style>
// element written to <head> — see zdtp CHANGELOG 0.4.3 "Other Changes"). No
// consumer-side CSS import is required; global.css's former mid-file
// `@import "@takazudo/zdtp/styles.css"` was removed for #117.
import { previewTokenPanelConfig } from "@/config/preview-token-panel-config";
import {
  drainPrehydrationToggle,
  installOwnerConsoleHelpers,
} from "./token-panel-native-bootstrap";

let bootstrapped = false;

export function bootstrapPreviewTokenPanel(): void {
  if (typeof window === "undefined") return;
  if (!bootstrapped) {
    bootstrapped = true;
    bootstrapDesignTokenPanel(() => previewTokenPanelConfig);
    installOwnerConsoleHelpers(() => previewTokenPanelConfig);
  }
  drainPrehydrationToggle("zdtp-preview-prehydrate", "toggle-preview-token-panel");
}
