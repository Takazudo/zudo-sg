/**
 * zdtp (zudo-design-token-panel) PanelConfig for the styleguide package.
 *
 * Passed to `configurePanel(designTokenPanelConfig)` in the bootstrap module.
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
import type { ColorScheme as LocalColorScheme } from "./color-schemes";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "./color-scheme-utils";
import { settings } from "./settings";
import { DESIGN_TOKEN_SCHEMA } from "@takazudo/zudo-doc/theme";

const BASE_DEFAULTS = {
  background: 0,
  foreground: 15,
  cursor: 6,
  selectionBg: 0,
  selectionFg: 15,
} as const;

const DEFAULT_SHIKI_THEME = "github-dark";

function toZdtpColorSchemes(
  schemes: Record<string, LocalColorScheme>,
): Record<string, ZdtpColorScheme> {
  const normalized: Record<string, ZdtpColorScheme> = {};
  for (const [name, scheme] of Object.entries(schemes)) {
    normalized[name] = {
      ...scheme,
      shikiTheme: scheme.shikiTheme ?? DEFAULT_SHIKI_THEME,
    };
  }
  return normalized;
}

function getInitialPalette(): readonly string[] {
  const scheme = colorSchemes[settings.colorScheme];
  if (!scheme) {
    throw new Error(
      `Unknown color scheme: "${settings.colorScheme}". Available: ${Object.keys(colorSchemes).join(", ")}`,
    );
  }
  return scheme.palette;
}

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
  return { id: PALETTE_TIER_ID, label: "Palette", items };
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
  return { id: "semantic", label: "Semantic", items, referencesTier: PALETTE_TIER_ID };
}

const COLOR_EXTRAS: ColorClusterExtras = {
  id: "zudo-sg-styleguide",
  label: "Styleguide",
  baseRoles: {
    background: "--zd-bg",
    foreground: "--zd-fg",
    cursor: "--zd-cursor",
    selectionBg: "--zd-sel-bg",
    selectionFg: "--zd-sel-fg",
  },
  baseDefaults: BASE_DEFAULTS,
  defaultShikiTheme: DEFAULT_SHIKI_THEME,
  colorSchemes: toZdtpColorSchemes(colorSchemes),
  panelSettings: {
    colorScheme: settings.colorScheme,
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

const FONT_SCALE_TIER_ID = "font-scale";

const FONT_TAB: TabConfig = {
  id: "font",
  label: "Font",
  tiers: [
    tierFromGroup(FONT_TOKENS, FONT_SCALE_TIER_ID, "Scale"),
    tierFromGroup(FONT_TOKENS, "font-size", "Font size"),
    tierFromGroup(FONT_TOKENS, "line-height", "Line height"),
    tierFromGroup(FONT_TOKENS, "font-weight", "Font weight"),
    tierFromGroup(FONT_TOKENS, "font-family", "Font family"),
  ],
};

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

const SIZE_TAB: TabConfig = {
  id: "size",
  label: "Size",
  tiers: [
    tierFromGroup(SIZE_TOKENS, "radius", "Radius"),
    tierFromGroup(SIZE_TOKENS, "transition", "Transition"),
  ],
};

export const designTokenPanelConfig: PanelConfig = {
  storagePrefix: "zudo-sg-styleguide-tweak",
  consoleNamespace: "zudoSgStyleguide",
  modalClassPrefix: "zudo-sg-styleguide-design-token-panel-modal",
  schemaId: DESIGN_TOKEN_SCHEMA,
  exportFilenameBase: "zudo-sg-styleguide-design-tokens",
  tabs: [COLOR_TAB, FONT_TAB, SPACING_TAB, SIZE_TAB],
  colorPresets: {},
};
