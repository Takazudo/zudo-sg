"use client";

// Side-effect import — running this module in the browser triggers
// configurePanel(previewTokenPanelConfig) which mounts the preview zdtp panel
// and registers the `toggle-preview-token-panel` window listener.
import "@/lib/preview-token-panel-bootstrap";

import type { JSX } from "preact";

function PreviewTokenPanelBootstrap(): JSX.Element | null {
  return null;
}
PreviewTokenPanelBootstrap.displayName = "PreviewTokenPanelBootstrap";

export default PreviewTokenPanelBootstrap;
