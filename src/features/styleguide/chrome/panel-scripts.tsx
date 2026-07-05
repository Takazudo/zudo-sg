/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Inline blocking scripts for the styleguide panel chrome:
//
//   PanelStateHeadScript — runs in <head> BEFORE first paint. Restores the
//     persisted code-panel width (CSS var) and the hidden state (data-attr)
//     onto <html> so a reload doesn't flash the default layout.
//
//   PanelResizersInitScript — runs at body-end. Wires the drag-to-resize
//     handle for the code panel, updating the CSS var live and persisting the
//     final width.
//
// The desktop SIDEBAR width is NOT handled here: it is owned by zudo-doc's
// DocLayout resizer (SidebarResizerInit / SidebarResizerRestore from
// @takazudo/zudo-doc/sidebar-resizer), which reads/writes the same
// `--zd-sidebar-w` var + `zudo-doc-sidebar-width` localStorage key declared in
// panel-contract.ts. These scripts cover only the styleguide-specific pieces:
// the code panel's width and hidden (toggle) state.
//
// Script text itself lives in panel-scripts-source.ts (a plain .ts module, so
// it can be unit-tested and can import panel-contract.ts's constants). This
// file is just the thin JSX wrapper.

import type { JSX } from "preact";
import { RESIZER_SCRIPT, RESTORE_SCRIPT } from "./panel-scripts-source";

export function PanelStateHeadScript(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: RESTORE_SCRIPT }} />;
}

export function PanelResizersInitScript(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: RESIZER_SCRIPT }} />;
}
