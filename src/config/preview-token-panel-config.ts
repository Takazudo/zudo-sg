/**
 * zdtp PanelConfig for the 2nd (preview) panel instance.
 *
 * This config drives the preview design-token panel — the panel that tweaks
 * @zudo-sg/ui target-website tokens and pushes them to the styleguide preview
 * iframes via the sink API. It is intentionally distinct from the doc-chrome
 * panel config (`design-token-panel-config.ts`):
 *
 *  - Distinct `storagePrefix` ("sg-preview-tweak") so localStorage keys never
 *    collide with the doc-chrome panel ("my-doc-tweak").
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
 * Token manifest: UI_COLOR_TOKENS / UI_SPACING_TOKENS / UI_FONT_TOKENS /
 * UI_SIZE_TOKENS from `ui-design-tokens-manifest.ts`. These cover the tokens
 * defined in `packages/ui/styles/tokens.css` and `colors.css`.
 *
 * The Color tab is a generic "Color" tab (`GenericTab`, non-reserved id) — not
 * the dedicated zdtp `ColorTab` cluster, whose flat-indexed-palette +
 * single-index-semantics + scheme-switch model does not fit @zudo-sg/ui's
 * family-named palette and `light-dark()` semantics. Inside it:
 *   - a "Palette" tier surfaces the Tier-1 `--palette-*` colors as
 *     `{ kind: "color" }` swatches (see buildPaletteTier below);
 *   - the Tier-2 semantic `--color-*` tokens are free-text rows because a
 *     single-axis slider can't drive a `light-dark()` expression.
 */

import type { PanelConfig, TabConfig, TierConfig, TierItem, TokenDef } from "@takazudo/zdtp";
import {
  UI_PALETTE_COLORS,
  UI_COLOR_TOKENS,
  UI_SPACING_TOKENS,
  UI_FONT_TOKENS,
  UI_SIZE_TOKENS,
} from "./ui-design-tokens-manifest";
import {
  applyPreviewVars,
  clearPreviewVars,
} from "@/features/styleguide/token-tweak/preview-iframe-registry";
import { applyEndpoint, applyRouting } from "virtual:zdtp-apply-config";

// ---------------------------------------------------------------------------
// Helpers — reuse the same toTierItem / tierFromGroup pattern as the doc panel.
// ---------------------------------------------------------------------------

function toTierItem(t: TokenDef): TierItem {
  let kind;
  if (t.control === "select") {
    kind = { kind: "select" as const, options: t.options ?? [] };
  } else if (t.control === "text") {
    kind = { kind: "text" as const };
  } else {
    kind = {
      kind: "length" as const,
      step: t.step,
      unit: t.unit,
    };
  }
  const item: TierItem = {
    id: t.id,
    cssVar: t.cssVar,
    label: t.label,
    default: t.default,
    type: kind,
  };
  if (t.pill) item.pill = t.pill;
  if (t.readonly) item.readonly = true;
  return item;
}

function tierFromGroup(
  tokens: readonly TokenDef[],
  groupId: string,
  label: string,
): TierConfig {
  return {
    id: groupId,
    label,
    items: tokens.filter((t) => t.group === groupId).map(toTierItem),
  };
}

// ---------------------------------------------------------------------------
// Color tab — use a non-reserved id ("ui-color") so zdtp routes this to
// GenericTab rather than the dedicated ColorTab. The dedicated ColorTab's
// cluster model assumes a flat indexed palette (--zd-0..15) with single-index
// semantic references and a scheme-switch system — which does not fit
// @zudo-sg/ui's family-named palette (--palette-cool-700, …) and light-dark()
// semantics. So we stay on GenericTab and express the layers as ordinary tiers:
//
//   - "Palette" tier: the Tier-1 --palette-* colors as { kind: "color" }
//     swatches (built inline below — TokenDef has no "color" control, mirroring
//     the doc panel's buildPaletteTier). Each item opts into format: "oklch"
//     (zdtp >= 0.3.3, the #372 fix) so GenericTab routes it through the OKLCH
//     ColorPicker — faithfully displaying and editing the oklch() palette values
//     with no lossy hex round-trip — instead of the default native
//     <input type="color">. Editing one pushes --palette-* to the preview
//     iframes, cascading into every semantic --color-* that reads it.
//   - "Ink"/"Surface"/… tiers: the Tier-2 semantic tokens as text rows
//     (light-dark() expressions, which a single-axis slider can't drive).
// ---------------------------------------------------------------------------

const PALETTE_TIER_ID = "ui-palette";

/**
 * Tier-1 palette swatches. Built inline as direct TierItems with
 * `type: { kind: "color" }` because zdtp's `TokenDef.control` has no "color"
 * option, so the toTierItem path can't express these — same approach as the
 * doc panel's `buildPaletteTier()`. Source data: UI_PALETTE_COLORS, which is
 * cross-checked against packages/ui/styles/colors.css.
 *
 * `format: "oklch"` (zdtp >= 0.3.3) opts each swatch into the OKLCH ColorPicker
 * so the oklch() defaults render and edit losslessly. Omitting it would fall
 * back to a native <input type="color"> that hex-approximates the value and
 * emits hex on commit — the exact regression tracked upstream as #372.
 */
function buildPaletteTier(): TierConfig {
  const items: TierItem[] = UI_PALETTE_COLORS.map(({ name, value }) => ({
    id: `palette-${name}`,
    cssVar: `--palette-${name}`,
    label: `palette-${name}`,
    default: value,
    type: { kind: "color" as const, format: "oklch" as const },
  }));
  return {
    id: PALETTE_TIER_ID,
    label: "Palette",
    items,
  };
}

const COLOR_TAB: TabConfig = {
  id: "ui-color",
  label: "Color",
  tiers: [
    buildPaletteTier(),
    tierFromGroup(UI_COLOR_TOKENS, "ink", "Ink"),
    tierFromGroup(UI_COLOR_TOKENS, "surface", "Surface"),
    tierFromGroup(UI_COLOR_TOKENS, "line", "Line"),
    tierFromGroup(UI_COLOR_TOKENS, "brand", "Brand"),
    tierFromGroup(UI_COLOR_TOKENS, "state", "State"),
  ],
};

// ---------------------------------------------------------------------------
// Spacing tab
// ---------------------------------------------------------------------------

const SPACING_TAB: TabConfig = {
  id: "spacing",
  label: "Spacing",
  tiers: [
    tierFromGroup(UI_SPACING_TOKENS, "hsp", "Horizontal spacing"),
    tierFromGroup(UI_SPACING_TOKENS, "vsp", "Vertical spacing"),
  ],
};

// ---------------------------------------------------------------------------
// Font tab
// ---------------------------------------------------------------------------

const FONT_TAB: TabConfig = {
  id: "font",
  label: "Font",
  tiers: [
    tierFromGroup(UI_FONT_TOKENS, "font-size", "Font size"),
    tierFromGroup(UI_FONT_TOKENS, "font-size-lh", "Font size / line height"),
    tierFromGroup(UI_FONT_TOKENS, "font-weight", "Font weight"),
    tierFromGroup(UI_FONT_TOKENS, "line-height", "Line height"),
    tierFromGroup(UI_FONT_TOKENS, "font-family", "Font family"),
  ],
};

// ---------------------------------------------------------------------------
// Size tab
// ---------------------------------------------------------------------------

const SIZE_TAB: TabConfig = {
  id: "size",
  label: "Size",
  tiers: [
    tierFromGroup(UI_SIZE_TOKENS, "radius", "Radius"),
    tierFromGroup(UI_SIZE_TOKENS, "shadow", "Shadow"),
  ],
};

// ---------------------------------------------------------------------------
// PanelConfig export
// ---------------------------------------------------------------------------

export const previewTokenPanelConfig: PanelConfig = {
  // Distinct from the doc-chrome panel ("my-doc-tweak") — prevents localStorage
  // key collisions when both panels are active on the same page.
  storagePrefix: "sg-preview-tweak",
  consoleNamespace: "sgPreview",
  modalClassPrefix: "sg-preview-design-token-panel-modal",
  // Schema for this panel's exported JSON. Using a distinct value from the
  // doc-chrome panel ("zudo-doc-design-tokens/v1") so preview exports are not
  // accidentally imported into the doc-chrome panel and vice-versa.
  schemaId: "sg-preview-design-tokens/v1",
  exportFilenameBase: "sg-preview-design-tokens",
  // Distinct toggle-event channel — dispatching "toggle-design-token-panel"
  // (the doc-chrome event) will NOT open this panel, and dispatching this event
  // will NOT open the doc-chrome panel.
  toggleEvent: "toggle-preview-token-panel",
  tabs: [COLOR_TAB, SPACING_TAB, FONT_TAB, SIZE_TAB],
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
  // plugins/zdtp-apply-proxy-plugin.mjs for the endpoint/routing wiring and
  // the "palette"-only scope (Tailwind v4 `@theme`-scoped tokens — spacing,
  // font, radius, shadow, semantic color — aren't reachable by this pipeline
  // today; see that file's header comment for the tracked follow-ups).
  applyEndpoint,
  applyRouting,
};
