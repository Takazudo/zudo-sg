/**
 * Production bootstrap for the doc-chrome zdtp panel.
 *
 * The zudo-doc package owns the wiring mechanism: configurePanel,
 * zfb-navigation lifecycle integration, and mode-scoped rebuilds when the
 * light/dark scheme changes. This file supplies the project's PanelConfig data
 * and preserves the project-specific console autoload helpers.
 */

import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
import {
  enableAutoload,
  disableAutoload,
} from "@takazudo/zdtp";
import { buildDesignTokenPanelConfig } from "@/config/design-token-panel-config";

bootstrapDesignTokenPanel(buildDesignTokenPanelConfig);

function readMode(): "light" | "dark" {
  if (typeof document !== "undefined") {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  return "light";
}

if (typeof window !== "undefined") {
  const configForCurrentMode = () => buildDesignTokenPanelConfig(readMode());
  const ns = configForCurrentMode().consoleNamespace;
  const w = window as unknown as Record<string, Record<string, unknown> | undefined>;
  w[ns] = {
    ...w[ns],
    enableAutoload: () => enableAutoload(configForCurrentMode()),
    disableAutoload: () => disableAutoload(configForCurrentMode()),
  };
}
