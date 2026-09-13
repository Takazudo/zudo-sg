/**
 * zdtp PanelConfig factory for the PREVIEW design-token panel instance.
 *
 * This panel tweaks the host's target-website tokens (the component
 * package's CSS, e.g. @zudo-sg/ui) and pushes them to the styleguide preview
 * iframes via the sink API. It is intentionally distinct from the host-owned
 * doc-chrome panel (`sg-doc-tweak`):
 *
 *  - Distinct `storagePrefix` ("sg-preview-tweak") so localStorage keys never
 *    collide with the doc-chrome panel ("sg-doc-tweak").
 *  - Distinct `consoleNamespace` ("sgPreview") so `window.sgPreview.*` commands
 *    target only this instance.
 *  - Distinct `modalClassPrefix` ("sg-preview-design-token-panel-modal") for
 *    independent BEM class namespacing.
 *  - Distinct `toggleEvent` ("toggle-preview-token-panel") so dispatching the
 *    doc-chrome toggle does NOT open the preview panel, and vice-versa.
 *  - `applySink` wired to `applyPreviewVars` / `clearPreviewVars` from the
 *    preview-iframe-registry, so slider drags flow to iframes rather than
 *    modifying the host `:root`.
 *
 * Tab data comes from the host: the tabs are derived from the host's generated
 * token manifest, so the factory takes them as input instead of importing a
 * host module. The apply endpoint/routing come from the
 * `@takazudo/zudo-sg/plugins/zdtp-apply-proxy` plugin's virtual module and are
 * `undefined` outside `zfb dev`.
 *
 * zdtp is an OPTIONAL peer: this module imports its types only, so it stays
 * loadable (and the panel simply never mounts) when zdtp is not installed.
 */

import type { PanelConfig, TabConfig } from "@takazudo/zdtp";
import { applyPreviewVars, clearPreviewVars } from "./preview-iframe-registry.js";

/** The host's manifest-derived tab set for the preview panel. */
export interface PreviewTokenPanelManifest {
  readonly tabs: readonly TabConfig[];
}

export interface PreviewTokenPanelConfigOptions {
  /** Same-origin apply endpoint (dev only). */
  applyEndpoint?: PanelConfig["applyEndpoint"];
  /** Token-prefix → CSS file routing map (dev only). */
  applyRouting?: PanelConfig["applyRouting"];
}

export const PREVIEW_TOKEN_PANEL_TOGGLE_EVENT = "toggle-preview-token-panel";

export function createPreviewTokenPanelConfig(
  manifest: PreviewTokenPanelManifest,
  options: PreviewTokenPanelConfigOptions = {},
): PanelConfig {
  return {
    // Distinct from the doc-chrome panel ("sg-doc-tweak") — prevents localStorage
    // key collisions when both panels are active on the same page.
    storagePrefix: "sg-preview-tweak",
    consoleNamespace: "sgPreview",
    modalClassPrefix: "sg-preview-design-token-panel-modal",
    // Distinct from the doc-chrome panel's schema ("zudo-design-tokens/v3") so
    // exports never cross-import between the two panels.
    schemaId: "sg-preview-design-tokens/v1",
    exportFilenameBase: "sg-preview-design-tokens",
    toggleEvent: PREVIEW_TOKEN_PANEL_TOGGLE_EVENT,
    // Public site: the tokens page dispatches the toggle for every visitor, so
    // the default `true` would arm owner-mode autoload for anyone (zdtp README §10.1).
    autoRememberOnOpen: false,
    tabs: manifest.tabs,
    // `colorPresets` only feeds the reserved 'color' ColorTab's "Scheme…"
    // dropdown; this panel has no such tab (a generic color tab + the reserved
    // 'palette' tab), so an empty map is the honest value.
    colorPresets: {},
    applySink: {
      apply: applyPreviewVars,
      clear: clearPreviewVars,
    },
    // Apply pipeline (zdtp README §3). The pinned zdtp (>=0.4.7) coalesces a
    // mixed Apply by resolved target file; downgrading below 0.4.7 reintroduces
    // the same-file clobber hazard.
    applyEndpoint: options.applyEndpoint,
    applyRouting: options.applyRouting,
  };
}
