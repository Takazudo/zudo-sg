/**
 * zdtp PanelConfig for the 2nd (preview) panel instance.
 *
 * This config drives the preview design-token panel — the panel that tweaks
 * @zudo-sg/ui target-website tokens and pushes them to the styleguide preview
 * iframes via the sink API. It is intentionally distinct from the doc-chrome
 * panel config (`design-token-panel-config.ts`):
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
 * Shared tab data: `ui-token-tabs.ts` owns the generated UI token manifest's
 * tabs so the build-safe static dashboard and this runtime panel stay in sync.
 * Browser/dev-only wiring remains here: the iframe sink and virtual Apply
 * endpoint are runtime dependencies that a static dashboard must not import.
 *
 * The Tier-1 `--palette-*` groups live in their own reserved `palette` tab
 * (zdtp 0.4.0 — see the shared tab module), not inside Color. The Color tab stays
 * a generic "Color" tab (`GenericTab`, non-reserved id) — not the dedicated
 * zdtp `ColorTab` cluster, whose ramp-reference semantic model is designed for
 * a doc-chrome `--palette-*` + `--zd-*` color scheme. @zudo-sg/ui owns a
 * family-named palette plus `light-dark()` semantic tokens, so its Tier-2
 * `--color-*` tokens stay free-text rows.
 *
 * Tier previews are enabled for font, spacing (`'bar'`), and radius (`'radius'`)
 * tiers. zdtp 0.6.0's instance-value font specimens fix the host-cascade defect
 * behind issue #577; the browser re-check on 0.6.1 is recorded in the shared
 * tab module.
 * The `shadow` tier stays bare because no preview kind matches free text, and
 * `ui-color`/`palette` render their own swatch/curve editors (issue #576).
 */

import type { PanelConfig } from "@takazudo/zdtp";
import { uiTokenTabs } from "./ui-token-tabs";
import {
  applyPreviewVars,
  clearPreviewVars,
} from "@/features/styleguide/token-tweak/preview-iframe-registry";
import { applyEndpoint, applyRouting } from "virtual:zdtp-apply-config";

// ---------------------------------------------------------------------------
// PanelConfig export
// ---------------------------------------------------------------------------

export const previewTokenPanelConfig: PanelConfig = {
  // Distinct from the doc-chrome panel ("sg-doc-tweak") — prevents localStorage
  // key collisions when both panels are active on the same page.
  storagePrefix: "sg-preview-tweak",
  consoleNamespace: "sgPreview",
  modalClassPrefix: "sg-preview-design-token-panel-modal",
  // Schema for this panel's exported JSON. Using a distinct value from the
  // doc-chrome panel ("zudo-design-tokens/v3") so preview exports are not
  // accidentally imported into the doc-chrome panel and vice-versa.
  schemaId: "sg-preview-design-tokens/v1",
  exportFilenameBase: "sg-preview-design-tokens",
  // Distinct toggle-event channel — dispatching the reserved
  // "toggle-design-token-panel" event or the doc-chrome "toggle-sg-doc-tweak"
  // event will NOT open this panel, and dispatching this event will NOT open
  // the doc-chrome panel.
  toggleEvent: "toggle-preview-token-panel",
  // This is a public site: the /components/tokens page dispatches
  // "toggle-preview-token-panel" for every visitor, so default `true` would
  // arm owner-mode autoload for whoever opens it (README §10.1).
  autoRememberOnOpen: false,
  tabs: uiTokenTabs,
  // Left empty deliberately: `colorPresets` only feeds the "Scheme…" dropdown
  // rendered by the reserved 'color'/'color-secondary' ColorTab (verified
  // against zdtp 0.4.5's ColorTab source — the preset map is merged with
  // `colorExtras` there and nowhere else). This panel has neither
  // tab: the shared Color tab is a non-reserved GenericTab (no colorExtras, per
  // its own header comment) and the shared palette tab is the new reserved
  // 'palette' tab,
  // which has no scheme/preset concept of its own. A light/dark brand-preset
  // switcher for this panel would need a real colorExtras cluster, which does
  // not fit @zudo-sg/ui's family palette + light-dark() tokens — see the
  // header comment above.
  colorPresets: {},
  // Routes CSS-var writes to the preview iframes via the sink/relay API rather
  // than writing to the host document `:root`. This is the key wiring that lets
  // slider drags in this panel flow into every registered styleguide iframe.
  applySink: {
    apply: applyPreviewVars,
    clear: clearPreviewVars,
  },
  // Apply pipeline (zdtp README §3) — persists browser tweaks to CSS source.
  // Both fields resolve to `undefined` outside `zfb dev`; see
  // plugins/zdtp-apply-proxy-plugin.mjs for the endpoint/routing wiring. Routed
  // prefixes: palette + color → colors.css; spacing/text/font/leading/radius/
  // shadow → tokens.css (both files' top-level `:root`/`@theme` blocks are
  // rewritable). The pinned zdtp >=0.4.7 handler coalesces a complete mixed
  // Apply by resolved target file, so each same-file group is computed and
  // written together and returned as one response row. Downgrading below
  // 0.4.7 reintroduces the same-file clobber hazard; this is not a guarantee
  // that a disk write failure is transactional.
  applyEndpoint,
  applyRouting,
};
