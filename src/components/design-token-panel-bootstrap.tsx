"use client";

// Scanner-visible island for the project-owned doc panel. The statically
// imported bootstrap is zudo-doc 5.2's native lazy implementation: it contains
// no eager zdtp value import and probes persisted state before deciding whether
// to fetch the panel chunk.

import type { JSX } from "preact";
import { bootstrapDocTokenPanel } from "@/lib/design-token-panel-bootstrap";

function DocTokenPanelBootstrap(): JSX.Element | null {
  bootstrapDocTokenPanel();
  return null;
}
// Named distinctly from "DesignTokenPanelBootstrap" — that marker name is now
// claimed by the package's own island (@takazudo/zudo-doc/design-token-panel-bootstrap,
// scanner-visible since 4.x). Reusing it collided the two ("island marker name
// collision"), and zfb keeps only ONE island per marker — the package's heavy,
// eagerly-hydrating one would win, silently defeating this whole lazy-load gate.
DocTokenPanelBootstrap.displayName = "DocTokenPanelBootstrap";

export default DocTokenPanelBootstrap;
