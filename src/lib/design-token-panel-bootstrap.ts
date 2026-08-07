/**
 * Production bootstrap for the doc-chrome zdtp panel.
 *
 * The zudo-doc package owns the wiring mechanism: configurePanel,
 * zfb-navigation lifecycle integration, and mode-scoped rebuilds when the
 * light/dark scheme changes. This file supplies the project's PanelConfig data
 * and preserves the project-specific console autoload helpers.
 */

import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
import { buildDesignTokenPanelConfig } from "@/config/design-token-panel-config";
import {
  drainPrehydrationToggle,
  installOwnerConsoleHelpers,
} from "./token-panel-native-bootstrap";

let bootstrapped = false;

function readMode(): "light" | "dark" {
  if (typeof document !== "undefined") {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  return "light";
}

export function bootstrapDocTokenPanel(): void {
  if (typeof window === "undefined") return;
  if (!bootstrapped) {
    bootstrapped = true;
    bootstrapDesignTokenPanel(buildDesignTokenPanelConfig);

    const configForCurrentMode = () => buildDesignTokenPanelConfig(readMode());
    installOwnerConsoleHelpers(configForCurrentMode);
  }
  // Incoming soft-navigation HTML carries a fresh capture script even though
  // the native bootstrap stays registered for the document lifetime.
  drainPrehydrationToggle("zdtp-doc-prehydrate", "toggle-sg-doc-tweak");
}
