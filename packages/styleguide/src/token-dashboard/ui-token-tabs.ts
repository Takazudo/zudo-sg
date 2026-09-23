/**
 * Build-safe zdtp tab data for a host's UI design-token manifest.
 *
 * This module is shared by a host's runtime preview panel and its static
 * token dashboard (via `createTokenDashboards`). It deliberately contains
 * only data-shaping code — no manifest import, no browser/dev-server/panel-
 * runtime dependencies — so a host can call it from plain Node during a
 * build. The host's generated manifest (e.g. `ui-design-tokens-manifest.ts`,
 * written by `zudo-sg gen-token-manifest`) is passed in, shaped as
 * `UiDesignTokensManifest`, so this module never depends on any specific
 * host's token set.
 */

import type { TabConfig, TierConfig, TierItem, TokenDef } from "@takazudo/zdtp";
import type { DashboardPreviewKind } from "@takazudo/zdtp/dashboard";
import type { GeneratedTokenGroups, GeneratedTokenGroup, TokenCategory } from "../token-spec.js";

/**
 * Tier-1 raw palette color — a plain name/value descriptor (NOT `TokenDef`)
 * because zdtp's `TokenDef.control` has no `"color"` option; this module
 * builds palette entries into `{ kind: "color" }` TierItems inline.
 */
export interface PaletteColor {
  /** Palette key without the `--palette-` prefix, e.g. "neutral-2". */
  name: string;
  /** Raw color value (e.g. an oklch() string). */
  value: string;
  cssVar?: string;
  id?: string;
  label?: string;
  group?: string;
  readonly?: boolean;
  note?: string;
}

/**
 * The shape a host's generated design-token manifest must provide. A host
 * assembles this from its own generated manifest module (whatever that
 * module's export names are) before calling `buildUiTokenTabs` /
 * `buildDashboardPreviewOverrides` / `createTokenDashboards`.
 */
type HostToken = TokenDef & { valueKind?: "number"; note?: string };

export interface UiDesignTokensManifest {
  paletteColors: readonly PaletteColor[];
  colorTokens: readonly HostToken[];
  spacingTokens: readonly HostToken[];
  fontTokens: readonly HostToken[];
  sizeTokens: readonly HostToken[];
  groups?: GeneratedTokenGroups;
}

// ---------------------------------------------------------------------------
// Helpers — reuse the same toTierItem / tierFromGroup pattern as the doc panel.
// ---------------------------------------------------------------------------

interface ToTierItemOptions {
  /**
   * Emit `{ kind: 'number', step }` instead of `{ kind: 'length', ... }`.
   * zdtp's `TokenControl` (upstream, this package doesn't own it) has no
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

function toTierItem(t: HostToken, opts?: ToTierItemOptions): TierItem {
  let kind;
  if (t.control === "select") {
    kind = { kind: "select" as const, options: t.options ?? [] };
  } else if (t.control === "text") {
    kind = { kind: "text" as const };
  } else if (t.valueKind === "number" || opts?.numberKind) {
    kind = { kind: "number" as const, step: t.step, unit: t.unit };
  } else {
    kind = {
      kind: "length" as const,
      step: t.step,
      unit: t.unit,
      ...(t.units ? { units: t.units } : {}),
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
// would put every group on one shared curve, which is wrong when groups are
// independent scales. Each business line also needs its own tier: the
// validator requires a shared named-item prefix, and each line hue needs its
// own OKLCH curve. The tab also gets a WCAG contrast-checker ("Check" mode)
// over the whole flattened palette for free, with no extra config.
//
// Per the reserved-tab contract, this TabConfig MUST omit `colorExtras`
// (`colorExtras` plus multiple `{ kind: "color" }` tiers only combine safely on
// the `color`/`color-secondary` cluster tabs).
// ---------------------------------------------------------------------------

/**
 * Split a palette color name into its group family and step/role:
 *   "neutral-2"           → { family: "neutral", step: "2" }
 *   "state-danger-dark"   → { family: "state", step: "danger-dark" }
 *   "line-vacuum-accent"  → { family: "line-vacuum", step: "accent" }
 * Names with no recognized grouping are kept as single-item families for
 * defensive compatibility.
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
 * Group palette colors into one TierConfig per family, in first-seen order,
 * each item opting into `format: "oklch"` (zdtp >= 0.3.3) so the panel edits
 * the oklch() defaults losslessly instead of hex-approximating them through a
 * native `<input type="color">` (the regression tracked upstream as #372).
 */
function buildPaletteTiers(paletteColors: readonly PaletteColor[]): TierConfig[] {
  const families = new Map<string, TierItem[]>();
  for (const { name, value } of paletteColors) {
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

function buildPaletteTab(paletteColors: readonly PaletteColor[]): TabConfig {
  return {
    id: "palette",
    label: "Palette",
    tiers: buildPaletteTiers(paletteColors),
  };
}

// ---------------------------------------------------------------------------
// Color tab — use a non-reserved id ("ui-color") so zdtp routes this to
// GenericTab rather than the dedicated ColorTab. The dedicated ColorTab's
// cluster model assumes a doc-chrome ramp scheme (`--palette-*` feeding
// `--zd-*` roles), which does not fit every host's color model (a host may
// use `light-dark()` semantics instead — the family-named palette itself
// lives in the palette tab above). So we stay on GenericTab for the Tier-2
// semantic tokens: "Surface"/"Text"/… tiers as text rows.
// ---------------------------------------------------------------------------

function buildColorTab(colorTokens: readonly TokenDef[]): TabConfig {
  return {
    id: "ui-color",
    label: "Color",
    tiers: [
      tierFromGroup(colorTokens, "surface", "Surface"),
      tierFromGroup(colorTokens, "text", "Text"),
      tierFromGroup(colorTokens, "accent", "Accent"),
      tierFromGroup(colorTokens, "rail", "Rail"),
      tierFromGroup(colorTokens, "state", "State"),
    ],
  };
}

// ---------------------------------------------------------------------------
// Spacing tab
// ---------------------------------------------------------------------------

function buildSpacingTab(spacingTokens: readonly TokenDef[]): TabConfig {
  return {
    id: "spacing",
    label: "Spacing",
    tiers: [
      { ...tierFromGroup(spacingTokens, "hsp", "Horizontal spacing"), preview: "bar" },
      { ...tierFromGroup(spacingTokens, "vsp", "Vertical spacing"), preview: "bar" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Font tab
// ---------------------------------------------------------------------------

function buildFontTab(fontTokens: readonly TokenDef[]): TabConfig {
  return {
    id: "font",
    label: "Font",
    tiers: [
      { ...tierFromGroup(fontTokens, "font-size", "Font size"), preview: "size" },
      {
        ...tierFromGroup(fontTokens, "font-size-lh", "Font size / line height", {
          numberKind: true,
        }),
        preview: "line-height",
        // Tier-level base is a compromise for the per-size leading rows.
        previewBase: "--text-base",
      },
      {
        ...tierFromGroup(fontTokens, "font-weight", "Font weight"),
        preview: "weight",
      },
      {
        ...tierFromGroup(fontTokens, "line-height", "Line height", {
          numberKind: true,
        }),
        preview: "line-height",
        previewBase: "--text-base",
      },
      {
        ...tierFromGroup(fontTokens, "font-family", "Font family"),
        preview: "family",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Size tab
// ---------------------------------------------------------------------------

function buildSizeTab(sizeTokens: readonly TokenDef[]): TabConfig {
  return {
    id: "size",
    label: "Size",
    tiers: [
      { ...tierFromGroup(sizeTokens, "radius", "Radius"), preview: "radius" },
      // No preview: free-text tier, no matching preview kind applies.
      tierFromGroup(sizeTokens, "shadow", "Shadow"),
    ],
  };
}

/** Build portable generic tabs from host-owned ordered metadata. */
function buildHostTabs(manifest: UiDesignTokensManifest, groups: GeneratedTokenGroups): TabConfig[] {
  const categories: readonly TokenCategory[] = ["color", "palette", "spacing", "font", "size"];
  const tokenSets = {
    color: manifest.colorTokens,
    spacing: manifest.spacingTokens,
    font: manifest.fontTokens,
    size: manifest.sizeTokens,
  };
  return categories.flatMap((category) => {
    const definitions = groups[category];
    if (!definitions?.length) return [];
    const tiers = definitions.map((group: GeneratedTokenGroup): TierConfig => {
      const items = category === "palette"
        ? manifest.paletteColors.filter((color) => color.group === group.id).map((color): TierItem => ({
            id: color.id ?? `palette-${color.name}`,
            cssVar: color.cssVar ?? `--palette-${color.name}`,
            label: color.label ?? `palette-${color.name}`,
            default: color.value,
            type: { kind: "color", ...(color.value.trim().startsWith("oklch(") ? { format: "oklch" as const } : {}) },
            ...(color.readonly ? { readonly: true as const } : {}),
          }))
        : tokenSets[category].filter((token) => token.group === group.id).map((token) => toTierItem(token));
      return {
        id: group.id,
        label: group.label,
        items,
        ...(group.preview ? { preview: group.preview } : {}),
        ...(group.previewBase ? { previewBase: group.previewBase } : {}),
      };
    });
    // Generic tab ids avoid zdtp's dedicated palette/color/spacing/font/size
    // renderers, whose demo vocabulary and palette ramp contract are narrower.
    return [{ id: `ui-${category}`, label: category[0]!.toUpperCase() + category.slice(1), tiers }];
  });
}

/**
 * Shared tab data consumed by both a host's runtime preview panel and its
 * static dashboard. Callers should build this ONCE per manifest and reuse
 * the same array reference for both consumers, so their identities,
 * ordering, defaults, and preview metadata cannot drift apart.
 */
export function buildUiTokenTabs(manifest: UiDesignTokensManifest): TabConfig[] {
  if (manifest.groups) return buildHostTabs(manifest, manifest.groups);
  return [
    buildColorTab(manifest.colorTokens),
    buildPaletteTab(manifest.paletteColors),
    buildSpacingTab(manifest.spacingTokens),
    buildFontTab(manifest.fontTokens),
    buildSizeTab(manifest.sizeTokens),
  ];
}

/**
 * Explicit dashboard samples for manifest rows whose editor kind cannot
 * describe the desired read-only sample: light-dark() text rows need color
 * swatches, and shadow declarations need shadow samples.
 */
export function buildDashboardPreviewOverrides(
  manifest: UiDesignTokensManifest,
): Readonly<Record<string, DashboardPreviewKind>> {
  const overrides: Record<string, DashboardPreviewKind> = {};
  for (const token of manifest.colorTokens) overrides[token.cssVar] = "color";
  if (!manifest.groups) {
    for (const token of manifest.sizeTokens) {
      if (token.group === "shadow") overrides[token.cssVar] = "shadow";
    }
  }
  return overrides;
}

/** Fixed specimen text shared by the light and dark dashboard instances. */
export const UI_DASHBOARD_PREVIEW_TEXT: string =
  "Design tokens give an interface a shared rhythm across pages and themes. This specimen keeps the declared values visible while you compare scale, color, and shape (102 entries). デザイントークンは、画面のリズムと読みやすさを支えます。\n\nThe light and dark views are isolated from panel edits, so saved tweaks never change this reference. 数字の 0、1、2、3、4 も宣言された値の一部として確認できます。";
