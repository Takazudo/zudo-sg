/**
 * Build-safe zdtp tab data for the @zudo-sg/ui token manifest.
 *
 * This module is shared by the runtime preview panel and the static token
 * dashboard. It deliberately contains only data-shaping code and the
 * generated manifest import, so it can be imported by plain Node during a
 * build without browser, dev-server, or panel-runtime dependencies.
 */

import type { TabConfig, TierConfig, TierItem, TokenDef } from "@takazudo/zdtp";
import type { DashboardPreviewKind } from "@takazudo/zdtp/dashboard";
import {
  UI_PALETTE_COLORS,
  UI_COLOR_TOKENS,
  UI_SPACING_TOKENS,
  UI_FONT_TOKENS,
  UI_SIZE_TOKENS,
} from "./ui-design-tokens-manifest.ts";

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
   * The public `assertValidPanelConfig` unit-test gate checks this contract.
   * For unitless tokens the row editor treats `number` and `length` identically,
   * and no persisted state records the kind.
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
// are independent scales. Each business line also needs its own tier: the
// validator requires a shared named-item prefix, and each line hue needs its
// own OKLCH curve. The tab also gets a WCAG contrast-checker ("Check" mode)
// over the whole flattened palette for free, with no extra config.
//
// Per the reserved-tab contract, this TabConfig MUST omit `colorExtras`
// (`colorExtras` plus multiple `{ kind: "color" }` tiers only combine safely on
// the `color`/`color-secondary` cluster tabs).
// ---------------------------------------------------------------------------

/**
 * Split a `UI_PALETTE_COLORS` name into its group family and step/role:
 *   "neutral-2"           → { family: "neutral", step: "2" }
 *   "state-danger-dark"   → { family: "state", step: "danger-dark" }
 *   "line-vacuum-accent"  → { family: "line-vacuum", step: "accent" }
 * Names with no recognized grouping are kept as single-item families for
 * defensive compatibility, but the committed @zudo-sg/ui palette uses grouped
 * names (neutral / accent / state / line).
 */
function splitPaletteName(name: string): { family: string; step: string | null } {
  const lineMatch = /^(line-[^-]+)-(.+)$/.exec(name);
  if (lineMatch) return { family: lineMatch[1]!, step: lineMatch[2]! };
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
    label: family
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" · "),
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

// Re-enabled after the issue #577 browser re-check on zdtp 0.6.1: editing
// --text-2xl from 2.5rem to 5rem moved the computed specimen from 40px to 80px.
// Doc-panel edits to --text-micro (3rem), --font-weight-normal (900), and
// --font-sans (monospace) changed the host vars while this specimen stayed at
// 80px, weight 400, and its own UI sans family. Upstream 0.6.0 commit 7d18952
// renders specimen fonts from instance values (zudo-design-token-panel#850),
// so the preview panel's specimens no longer depend on the host cascade.
// Size/line-height previews also restore the specimen toolbar / Render on page.
const FONT_TAB: TabConfig = {
  id: "font",
  label: "Font",
  tiers: [
    { ...tierFromGroup(UI_FONT_TOKENS, "font-size", "Font size"), preview: "size" },
    {
      ...tierFromGroup(UI_FONT_TOKENS, "font-size-lh", "Font size / line height", {
        numberKind: true,
      }),
      preview: "line-height",
      // Tier-level base is a compromise for the per-size leading rows.
      previewBase: "--text-base",
    },
    {
      ...tierFromGroup(UI_FONT_TOKENS, "font-weight", "Font weight"),
      preview: "weight",
    },
    {
      ...tierFromGroup(UI_FONT_TOKENS, "line-height", "Line height", {
        numberKind: true,
      }),
      preview: "line-height",
      previewBase: "--text-base",
    },
    {
      ...tierFromGroup(UI_FONT_TOKENS, "font-family", "Font family"),
      preview: "family",
    },
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

/**
 * Shared tab data consumed by both the runtime preview panel and the static
 * dashboard. Keep this as one array so their identities, ordering, defaults,
 * and preview metadata cannot drift apart.
 */
export const uiTokenTabs: readonly TabConfig[] = [
  COLOR_TAB,
  PALETTE_TAB,
  SPACING_TAB,
  FONT_TAB,
  SIZE_TAB,
];

/** #586 restored the font previews, so the dashboard can use the same array. */
export const uiDashboardTabs: readonly TabConfig[] = uiTokenTabs;

function buildDashboardPreviewOverrides(): Readonly<Record<string, DashboardPreviewKind>> {
  const overrides: Record<string, DashboardPreviewKind> = {};
  for (const token of UI_COLOR_TOKENS) overrides[token.cssVar] = "color";
  for (const token of UI_SIZE_TOKENS) {
    if (token.group === "shadow") overrides[token.cssVar] = "shadow";
  }
  return overrides;
}

/**
 * Explicit dashboard samples for manifest rows whose editor kind cannot
 * describe the desired read-only sample: light-dark() text rows need color
 * swatches, and shadow declarations need shadow samples.
 */
export const dashboardPreviewOverrides: Readonly<Record<string, DashboardPreviewKind>> =
  buildDashboardPreviewOverrides();

/** Fixed specimen text shared by the light and dark dashboard instances. */
export const UI_DASHBOARD_PREVIEW_TEXT: string =
  "Design tokens give an interface a shared rhythm across pages and themes. This specimen keeps the declared values visible while you compare scale, color, and shape (102 entries). デザイントークンは、画面のリズムと読みやすさを支えます。\n\nThe light and dark views are isolated from panel edits, so saved tweaks never change this reference. 数字の 0、1、2、3、4 も宣言された値の一部として確認できます。";
