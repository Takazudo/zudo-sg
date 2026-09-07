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
 * Token manifest: UI_COLOR_TOKENS / UI_SPACING_TOKENS / UI_FONT_TOKENS /
 * UI_SIZE_TOKENS from `ui-design-tokens-manifest.ts`. These cover the tokens
 * defined in `packages/ui/styles/tokens.css` and `colors.css`.
 *
 * The Tier-1 `--palette-*` groups live in their own reserved `palette` tab
 * (zdtp 0.4.0 — see PALETTE_TAB below), not inside Color. The Color tab stays
 * a generic "Color" tab (`GenericTab`, non-reserved id) — not the dedicated
 * zdtp `ColorTab` cluster, whose ramp-reference semantic model is designed for
 * a doc-chrome `--palette-*` + `--zd-*` color scheme. @zudo-sg/ui owns a
 * family-named palette plus `light-dark()` semantic tokens, so its Tier-2
 * `--color-*` tokens stay free-text rows.
 *
 * Tier previews (zdtp 0.4.15+, opt-in via `TierConfig.preview`) are turned on
 * for the spacing (`'bar'`) and radius (`'radius'`) tiers ONLY — see
 * SPACING_TAB/SIZE_TAB below. Unlike the doc-chrome panel, this panel's whole
 * `font` tab stays bare: zdtp 0.5.1 resolves font-specimen styles through the
 * HOST cascade, which an `applySink` panel never writes to, so a font preview
 * here would render the doc-chrome panel's typography instead of this panel's
 * (#577 — full reasoning in the block comment above FONT_TAB). The `shadow`
 * size tier and the `ui-color`/`palette` tabs deliberately have no preview
 * either — `shadow` is a free-text tier with no matching preview kind, and the
 * color tiers render their own swatch/curve editors instead (issue #576).
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

interface ToTierItemOptions {
  /**
   * Emit `{ kind: 'number', step }` instead of `{ kind: 'length', ... }`.
   * zdtp's `TokenControl` (upstream, this repo doesn't own it) has no
   * "number" member, so a unitless token like `--leading-normal` would
   * otherwise become `{ kind: 'length', unit: '' }` — but zdtp's
   * `preview: 'line-height'` contract requires a `number` tier.
   *
   * This panel currently ships NO line-height preview (see FONT_TAB), so the
   * opt-in buys nothing here today; it is kept in lockstep with the doc-chrome
   * panel so re-enabling the font previews stays the one-line-per-tier change
   * FONT_TAB promises. It is behaviour-neutral: for a unitless token zdtp's
   * row editor treats `number` and `length` identically, and no persisted
   * state records the kind.
   */
  numberKind?: boolean;
}

function toTierItem(t: TokenDef, opts?: ToTierItemOptions): TierItem {
  let kind;
  if (t.control === "select") {
    kind = { kind: "select" as const, options: t.options ?? [] };
  } else if (t.control === "text") {
    kind = { kind: "text" as const };
  } else if (opts?.numberKind) {
    kind = { kind: "number" as const, step: t.step, unit: t.unit };
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
  opts?: ToTierItemOptions,
): TierConfig {
  return {
    id: groupId,
    label,
    items: tokens.filter((t) => t.group === groupId).map((t) => toTierItem(t, opts)),
  };
}

// ---------------------------------------------------------------------------
// Palette tab — zdtp 0.4.0's reserved `palette` tab (joins color/font/spacing/
// size). It dispatches to PaletteTab, NOT GenericTab, and expects each group
// of `--palette-{group}-{step-or-role}` steps as its own TierConfig (the tier's
// `label` becomes the group heading; dragging its OKLCH L/C/H curve re-derives
// every step in that ONE tier and commits the whole group in a single write).
// A flat single-tier dump (the pre-0.4.0 GenericTab layout this replaces)
// would put every group on one shared curve, which is wrong — base/accent/state
// are independent scales. The tab also gets a
// WCAG contrast-checker ("Check" mode) over the whole flattened palette for
// free, with no extra config.
//
// Per the reserved-tab contract, this TabConfig MUST omit `colorExtras`
// (colorExtras + multiple `{ kind: "color" }` tiers only combine safely on
// the 'color'/'color-secondary' cluster tabs).
// ---------------------------------------------------------------------------

/**
 * Split a `UI_PALETTE_COLORS` name into its group family and step/role:
 *   "neutral-2"           → { family: "neutral", step: "2" }
 *   "state-danger-dark"   → { family: "state", step: "danger-dark" }
 *   "line-vacuum-accent"  → { family: "line",  step: "vacuum-accent" }
 * Names with no recognized grouping are kept as single-item families for
 * defensive compatibility, but the committed @zudo-sg/ui palette uses grouped
 * names (neutral / accent / state / line).
 */
function splitPaletteName(name: string): { family: string; step: string | null } {
  const lineMatch = /^line-(.+)$/.exec(name);
  if (lineMatch) return { family: "line", step: lineMatch[1] ?? null };
  const stateMatch = /^state-(.+)$/.exec(name);
  if (stateMatch) return { family: "state", step: stateMatch[1] ?? null };
  const match = /^(.+)-(\d+)$/.exec(name);
  if (!match) return { family: name, step: null };
  const [, family, step] = match;
  return { family: family ?? name, step: step ?? null };
}

/**
 * Group `UI_PALETTE_COLORS` into one TierConfig per family, in first-seen
 * order, each item opting into `format: "oklch"` (zdtp >= 0.3.3) so the panel
 * edits the oklch() defaults losslessly instead of hex-approximating them
 * through a native `<input type="color">` (the regression tracked upstream
 * as #372).
 */
function buildPaletteTiers(): TierConfig[] {
  const families = new Map<string, TierItem[]>();
  for (const { name, value } of UI_PALETTE_COLORS) {
    const { family } = splitPaletteName(name);
    const items = families.get(family) ?? [];
    items.push({
      id: `palette-${name}`,
      cssVar: `--palette-${name}`,
      label: `palette-${name}`,
      default: value,
      type: { kind: "color" as const, format: "oklch" as const },
    });
    families.set(family, items);
  }
  return Array.from(families.entries()).map(([family, items]) => ({
    id: `palette-${family}`,
    label: family.charAt(0).toUpperCase() + family.slice(1),
    items,
  }));
}

const PALETTE_TAB: TabConfig = {
  id: "palette",
  label: "Palette",
  tiers: buildPaletteTiers(),
};

// ---------------------------------------------------------------------------
// Color tab — use a non-reserved id ("ui-color") so zdtp routes this to
// GenericTab rather than the dedicated ColorTab. The dedicated ColorTab's
// cluster model assumes a doc-chrome ramp scheme (`--palette-*` feeding
// `--zd-*` roles), which does not fit @zudo-sg/ui's light-dark() semantics
// (the family-named palette itself lives in PALETTE_TAB above). So we stay on
// GenericTab for the Tier-2 semantic tokens: "Ink"/"Surface"/… tiers as text
// rows.
// ---------------------------------------------------------------------------

const COLOR_TAB: TabConfig = {
  id: "ui-color",
  label: "Color",
  tiers: [
    tierFromGroup(UI_COLOR_TOKENS, "surface", "Surface"),
    tierFromGroup(UI_COLOR_TOKENS, "text", "Text"),
    tierFromGroup(UI_COLOR_TOKENS, "accent", "Accent"),
    tierFromGroup(UI_COLOR_TOKENS, "rail", "Rail"),
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
    { ...tierFromGroup(UI_SPACING_TOKENS, "hsp", "Horizontal spacing"), preview: "bar" },
    { ...tierFromGroup(UI_SPACING_TOKENS, "vsp", "Vertical spacing"), preview: "bar" },
  ],
};

// ---------------------------------------------------------------------------
// Font tab
// ---------------------------------------------------------------------------

// NO `preview` on ANY tier here, deliberately — unlike the doc-chrome panel's Font
// tab, which carries the full set. zdtp 0.5.1's font-specimen renderer styles its
// samples with `var(--token, <panel value>)` and mounts them in the HOST document,
// which already defines every one of these vars at `:root`. This panel is an
// `applySink` instance: its writes go to the styleguide preview iframes, never to
// the host, so the panel value only ever reaches the dead fallback slot. Measured on
// zdtp 0.5.1 (#577): editing `--text-2xl` 2.5rem -> 5rem updates the row meta to
// `ui-text-2xl · 80px` while the sample stays at a computed 40px, and because both
// panels' first family/weight rows name the same vars, a DOC-panel edit visibly
// restyles this panel's specimen. A preview showing another panel's values is worse
// than no preview, so the font tiers stay bare until upstream stops resolving
// specimen styles through the host cascade.
//
// The `bar` (Spacing) and `radius` (Size) glyphs below are NOT affected and stay on:
// they write the resolved token value straight into the inline style with no `var()`,
// so they track this panel's own edits correctly (verified the same way).
//
// Dropping these previews also drops this panel's font-specimen toolbar and its
// "Render on page" control, which need the reserved `font` tab id PLUS at least one
// `size`/`line-height` preview. That is intended: the specimen is precisely the
// broken surface. Re-enabling is a one-line-per-tier change once upstream is fixed.
const FONT_TAB: TabConfig = {
  id: "font",
  label: "Font",
  tiers: [
    tierFromGroup(UI_FONT_TOKENS, "font-size", "Font size"),
    tierFromGroup(UI_FONT_TOKENS, "font-size-lh", "Font size / line height", {
      numberKind: true,
    }),
    tierFromGroup(UI_FONT_TOKENS, "font-weight", "Font weight"),
    tierFromGroup(UI_FONT_TOKENS, "line-height", "Line height", {
      numberKind: true,
    }),
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
    { ...tierFromGroup(UI_SIZE_TOKENS, "radius", "Radius"), preview: "radius" },
    // No preview: free-text tier, no matching preview kind applies.
    tierFromGroup(UI_SIZE_TOKENS, "shadow", "Shadow"),
  ],
};

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
  tabs: [COLOR_TAB, PALETTE_TAB, SPACING_TAB, FONT_TAB, SIZE_TAB],
  // Left empty deliberately: `colorPresets` only feeds the "Scheme…" dropdown
  // rendered by the reserved 'color'/'color-secondary' ColorTab (verified
  // against zdtp 0.4.5's ColorTab source — the preset map is merged with
  // `colorExtras` there and nowhere else). This panel has neither
  // tab: COLOR_TAB above is a non-reserved GenericTab (no colorExtras, per its
  // own header comment) and PALETTE_TAB is the new reserved 'palette' tab,
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
