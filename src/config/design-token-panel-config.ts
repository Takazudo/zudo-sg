/**
 * zdtp (zudo-design-token-panel) PanelConfig for this project.
 *
 * This config object is the single source of truth passed to
 * `configurePanel(designTokenPanelConfig)` in the bootstrap module.
 *
 * Type notes:
 * - zdtp's `ColorScheme.shikiTheme` has been optional since zdtp 0.2.3
 *   (Takazudo/zudo-design-token-panel#342) — this project's local `colorSchemes`
 *   map (whose `ColorScheme.shikiTheme` is also optional) is assignable to
 *   `colorExtras.colorSchemes` directly, with no normalization wrapper or cast.
 */

import type {
  PanelConfig,
  TabConfig,
  TierConfig,
  TierItem,
  ColorClusterExtras,
  ColorScheme as ZdtpColorScheme,
  TokenDef,
} from "@takazudo/zdtp";
import {
  SPACING_TOKENS,
  FONT_TOKENS,
  SIZE_TOKENS,
} from "./design-tokens-manifest";
import { colorSchemes } from "./color-schemes";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "./color-scheme-utils";
import { settings } from "./settings";
import { DESIGN_TOKEN_SCHEMA } from "@takazudo/zudo-doc/theme";

/**
 * Base-role fallback indices. Background defaults to palette index 0,
 * foreground to 15, cursor to 6, selection to 0/15.
 */
const BASE_DEFAULTS = {
  background: 0,
  foreground: 15,
  cursor: 6,
  selectionBg: 0,
  selectionFg: 15,
} as const;

/**
 * Fallback Shiki theme used when a color scheme's `shikiTheme` field is absent.
 */
const DEFAULT_SHIKI_THEME = "github-dark";

/**
 * A few extra doc-chrome schemes surfaced in the Color tab's "Scheme…"
 * dropdown alongside `colorExtras.colorSchemes` (see `PanelConfig.colorPresets`,
 * zdtp README §7.5) — same p0-p15 index convention documented above
 * `color-scheme-utils.ts`'s `SEMANTIC_DEFAULTS`. `semantic` is omitted: these
 * are dropdown-only extras, not this project's active schemes, so they don't
 * need the mermaid/chat/imageOverlay overrides `colorSchemes` (in
 * `color-schemes.ts`) carries for its own CSS output.
 */
const COLOR_PRESETS: Record<string, ZdtpColorScheme> = {
  Slate: {
    background: 9,
    foreground: 11,
    cursor: 6,
    selectionBg: 10,
    selectionFg: 11,
    palette: [
      "oklch(0.20 0.02 250)", "oklch(0.62 0.19 25)", "oklch(0.68 0.14 155)", "oklch(0.78 0.13 85)",
      "oklch(0.66 0.12 235)", "oklch(0.62 0.16 275)", "oklch(0.66 0.03 240)", "oklch(0.55 0.02 240)",
      "oklch(0.52 0.02 240)", "oklch(0.16 0.015 250)", "oklch(0.24 0.015 250)", "oklch(0.92 0.005 250)",
      "oklch(0.70 0.14 280)", "oklch(0.72 0.10 300)", "oklch(0.68 0.15 270)", "oklch(0.78 0.008 250)",
    ],
    shikiTheme: "github-dark",
  },
  Amber: {
    background: 9,
    foreground: 11,
    cursor: 6,
    selectionBg: 11,
    selectionFg: 10,
    palette: [
      "oklch(0.30 0.02 60)", "oklch(0.55 0.19 25)", "oklch(0.48 0.11 145)", "oklch(0.55 0.15 70)",
      "oklch(0.52 0.13 250)", "oklch(0.55 0.15 45)", "oklch(0.68 0.04 60)", "oklch(0.55 0.04 60)",
      "oklch(0.55 0.02 60)", "oklch(0.97 0.01 80)", "oklch(0.93 0.015 75)", "oklch(0.28 0.01 60)",
      "oklch(0.60 0.14 40)", "oklch(0.62 0.10 320)", "oklch(0.50 0.15 45)", "oklch(0.42 0.01 60)",
    ],
    shikiTheme: "github-light",
  },
};

/**
 * Initial palette taken from the configured active scheme.
 */
function getInitialPalette(): readonly string[] {
  const scheme = colorSchemes[settings.colorScheme];
  if (!scheme) {
    throw new Error(
      `Unknown color scheme: "${settings.colorScheme}". Available: ${Object.keys(colorSchemes).join(", ")}`,
    );
  }
  return scheme.palette;
}

// ---------------------------------------------------------------------------
// Helpers — partition flat manifest arrays into TabConfig.tiers by group.
// ---------------------------------------------------------------------------

/**
 * Convert a flat `TokenDef` to a `TierItem` (the zdtp tier-model shape).
 *
 * The mapping rules:
 *  - `control: "select"` → `type: { kind: 'select', options }`
 *  - `control: "text"`   → `type: { kind: 'text' }`
 *  - (default slider)    → `type: { kind: 'length', step, unit }`
 *
 * `pill` and `readonly` pass through unchanged.
 */
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

/**
 * Build a tier from the subset of `tokens` whose `group` matches `groupId`.
 */
function tierFromGroup(
  tokens: readonly TokenDef[],
  groupId: string,
  label: string,
): TierConfig {
  return {
    id: groupId,
    label,
    items: tokens
      .filter((t) => t.group === groupId)
      .map(toTierItem),
  };
}

// ---------------------------------------------------------------------------
// Color tab — palette and semantic tiers + colorExtras for cluster metadata.
// ---------------------------------------------------------------------------

const PALETTE_TIER_ID = "palette";

function buildPaletteTier(): TierConfig {
  const initial = getInitialPalette();
  const items: TierItem[] = [];
  for (let i = 0; i < 16; i++) {
    items.push({
      id: `p${i}`,
      cssVar: `--zd-${i}`,
      label: `p${i}`,
      default: initial[i] ?? "#808080",
      type: { kind: "color" },
    });
  }
  return {
    id: PALETTE_TIER_ID,
    label: "Palette",
    items,
  };
}

function buildSemanticTier(): TierConfig {
  const items: TierItem[] = [];
  for (const [key, cssVar] of Object.entries(SEMANTIC_CSS_NAMES)) {
    const idx = SEMANTIC_DEFAULTS[key];
    if (idx === undefined) continue;
    items.push({
      id: key,
      cssVar,
      label: key,
      default: `p${idx}`,
      type: { kind: "color" },
    });
  }
  return {
    id: "semantic",
    label: "Semantic",
    items,
    referencesTier: PALETTE_TIER_ID,
  };
}

const COLOR_EXTRAS: ColorClusterExtras = {
  // Zudo Sg-scoped identifiers — avoids localStorage collisions across the
  // owner's multiple zudo-doc sites (each of which would otherwise default to
  // the same template placeholder values).
  id: "sg-doc",
  label: "Doc Chrome",
  baseRoles: {
    background: "--zd-bg",
    foreground: "--zd-fg",
    cursor: "--zd-cursor",
    selectionBg: "--zd-sel-bg",
    selectionFg: "--zd-sel-fg",
  },
  baseDefaults: BASE_DEFAULTS,
  defaultShikiTheme: DEFAULT_SHIKI_THEME,
  // `colorSchemes`'s `shikiTheme` is optional in both the local and zdtp
  // `ColorScheme` types (see the file-header note), so this is a direct,
  // type-checked assignment — no normalization wrapper needed.
  colorSchemes,
  panelSettings: {
    colorScheme: settings.colorScheme,
    // colorMode: strip off respectPrefersColorScheme (not in zdtp's shape).
    colorMode: settings.colorMode
      ? {
          defaultMode: settings.colorMode.defaultMode,
          lightScheme: settings.colorMode.lightScheme,
          darkScheme: settings.colorMode.darkScheme,
        }
      : false,
  },
};

const COLOR_TAB: TabConfig = {
  id: "color",
  label: "Color",
  tiers: [buildPaletteTier(), buildSemanticTier()],
  colorExtras: COLOR_EXTRAS,
};

// ---------------------------------------------------------------------------
// Font tab
// ---------------------------------------------------------------------------

const FONT_TAB: TabConfig = {
  id: "font",
  label: "Font",
  tiers: [
    tierFromGroup(FONT_TOKENS, "font-size", "Font size"),
    tierFromGroup(FONT_TOKENS, "line-height", "Line height"),
    tierFromGroup(FONT_TOKENS, "font-weight", "Font weight"),
    tierFromGroup(FONT_TOKENS, "font-family", "Font family"),
  ],
};

// ---------------------------------------------------------------------------
// Spacing tab
// ---------------------------------------------------------------------------

const SPACING_TAB: TabConfig = {
  id: "spacing",
  label: "Spacing",
  tiers: [
    tierFromGroup(SPACING_TOKENS, "hsp", "Horizontal spacing"),
    tierFromGroup(SPACING_TOKENS, "vsp", "Vertical spacing"),
    tierFromGroup(SPACING_TOKENS, "icon", "Icons"),
    tierFromGroup(SPACING_TOKENS, "layout", "Layout"),
  ],
};

// ---------------------------------------------------------------------------
// Size tab
// ---------------------------------------------------------------------------

const SIZE_TAB: TabConfig = {
  id: "size",
  label: "Size",
  tiers: [
    tierFromGroup(SIZE_TOKENS, "radius", "Radius"),
    tierFromGroup(SIZE_TOKENS, "transition", "Transition"),
  ],
};

export const designTokenPanelConfig: PanelConfig = {
  // Zudo Sg-scoped identifiers (renamed from the template placeholders
  // "my-doc-tweak"/"myDoc"/"my-doc-*") — avoids localStorage collisions across
  // the owner's multiple zudo-doc sites. This is a one-time reset: anyone with
  // overrides saved under the old "my-doc-tweak-*" keys starts fresh under
  // "sg-doc-tweak-*" (the old keys are simply orphaned, not migrated).
  storagePrefix: "sg-doc-tweak",
  consoleNamespace: "sgDoc",
  modalClassPrefix: "sg-doc-design-token-panel-modal",
  // Explicit toggle channel. zdtp 0.3.0 binds the RESERVED default event
  // ("toggle-design-token-panel") only to the framework's empty-tabs default
  // instance, so a real prefixed panel left on the default channel never opens
  // (the empty shell mounts instead). Binding this panel to a prefix-derived
  // event ("toggle-sg-doc-tweak") means the doc-chrome triggers that dispatch
  // it open THIS 4-tab panel. The preview panel uses its own distinct channel
  // ("toggle-preview-token-panel"). See epic Takazudo/zudo-sg#84.
  toggleEvent: "toggle-sg-doc-tweak",
  // Must match DESIGN_TOKEN_SCHEMA in @takazudo/zudo-doc/theme so that
  // exported JSON files remain importable across panel versions.
  schemaId: DESIGN_TOKEN_SCHEMA,
  exportFilenameBase: "sg-doc-design-tokens",
  tabs: [COLOR_TAB, FONT_TAB, SPACING_TAB, SIZE_TAB],
  colorPresets: COLOR_PRESETS,
};
