"use client";

// Scanner-visible island for the project-owned preview panel. Its static
// bootstrap uses zudo-doc 5.2's native lazy zdtp boundary.

import type { JSX } from "preact";
import { bootstrapPreviewTokenPanel } from "@/lib/preview-token-panel-bootstrap";

function PreviewTokenPanelBootstrap(): JSX.Element | null {
  bootstrapPreviewTokenPanel();
  return null;
}
PreviewTokenPanelBootstrap.displayName = "PreviewTokenPanelBootstrap";

export default PreviewTokenPanelBootstrap;
