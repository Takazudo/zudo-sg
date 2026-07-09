"use client";

// Side-effect import — running this module in the browser bootstraps the
// doc-chrome zdtp panel, including the `toggle-sg-doc-tweak` listener and
// mode-scoped color defaults.
import "@/lib/design-token-panel-bootstrap";

import type { JSX } from "preact";

function DesignTokenPanelBootstrap(): JSX.Element | null {
  return null;
}
DesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";

export default DesignTokenPanelBootstrap;
