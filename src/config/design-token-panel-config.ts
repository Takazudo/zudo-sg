/**
 * zdtp (zudo-design-token-panel) PanelConfig for this project.
 *
 * The doc-chrome color model is ramp-native (`ColorScheme = { ramps, map }`).
 * The panel exposes it through two tabs:
 *
 * - Palette tab (`palette`): the shared base/accent/state ramps emitted as
 *   `--palette-*` custom properties.
 * - Color tab (`color`): base roles plus the 23 semantic `--zd-*` roles,
 *   expressed as grouped references into the Palette tab's ramp tiers.
 *
 * The color cluster is scheme-less (`colorExtras.colorSchemes = {}`): the
 * editable source of truth is the ramp/semantic tier model, not a legacy
 * 16-slot scheme preset registry.
 */

import type {
  PanelConfig,
  TabConfig,
  TierConfig,
  TierItem,
  ColorClusterExtras,
  TokenDef,
} from "@takazudo/zdtp";
import {
  SPACING_TOKENS,
  FONT_TOKENS,
  SIZE_TOKENS,
} from "./design-tokens-manifest";
import {
  getActiveScheme,
  STATE_ROLES,
  buildSemanticTierItems,
  type ColorScheme,
} from "./color-scheme-utils";
import { colorSchemes } from "./color-schemes";
import { settings } from "./settings";

const DEFAULT_SHIKI_THEME = "github-dark";

// ---------------------------------------------------------------------------
// Helpers — partition flat manifest arrays into TabConfig.tiers by group.
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
    items: tokens
      .filter((t) => t.group === groupId)
      .map(toTierItem),
  };
}

// ---------------------------------------------------------------------------
// Palette tab — three ramp tiers (base / accent / state), OKLCH curve editor.
// ---------------------------------------------------------------------------

function buildRampTiers(): TierConfig[] {
  const { ramps } = getActiveScheme();

  const baseTier: TierConfig = {
    id: "base",
    label: "Base",
    items: ramps.base.map((color, i): TierItem => ({
      id: `base-${i}`,
      cssVar: `--palette-base-${i}`,
      label: String(i),
      default: color,
      type: { kind: "color", format: "oklch" },
    })),
  };

  const accentTier: TierConfig = {
    id: "accent",
    label: "Accent",
    items: ramps.accent.map((color, i): TierItem => ({
      id: `accent-${i}`,
      cssVar: `--palette-accent-${i}`,
      label: String(i),
      default: color,
      type: { kind: "color", format: "oklch" },
    })),
  };

  const stateTier: TierConfig = {
    id: "state",
    label: "State",
    items: STATE_ROLES.map((role): TierItem => ({
      id: `state-${role}`,
      cssVar: `--palette-state-${role}`,
      label: role,
      default: ramps.state[role],
      type: { kind: "color", format: "oklch" },
    })),
  };

  return [baseTier, accentTier, stateTier];
}

const PALETTE_TAB: TabConfig = {
  id: "palette",
  label: "Palette",
  tiers: buildRampTiers(),
};

// ---------------------------------------------------------------------------
// Color tab — mode-scoped semantic tier referencing the Palette tab.
// ---------------------------------------------------------------------------

type PanelMode = "light" | "dark";

function schemeForMode(mode: PanelMode): ColorScheme {
  const cm = settings.colorMode;
  if (!cm) return getActiveScheme();
  const name = mode === "dark" ? cm.darkScheme : cm.lightScheme;
  return colorSchemes[name] ?? getActiveScheme();
}

function buildSemanticTier(mode: PanelMode): TierConfig {
  return {
    id: "semantic",
    label: "Semantic",
    semantic: true,
    referencesRamps: [
      { tab: "palette", tier: "base" },
      { tab: "palette", tier: "accent" },
      { tab: "palette", tier: "state" },
    ],
    items: buildSemanticTierItems(schemeForMode(mode)),
  };
}

function buildColorExtras(mode: PanelMode): ColorClusterExtras {
  const cm = settings.colorMode;
  const lightScheme = cm ? cm.lightScheme : settings.colorScheme;
  const darkScheme = cm ? cm.darkScheme : settings.colorScheme;
  return {
    id: "sg-doc",
    label: "Doc Chrome",
    baseRoles: {},
    baseDefaults: {},
    defaultShikiTheme: DEFAULT_SHIKI_THEME,
    colorSchemes: {},
    panelSettings: {
      colorScheme: settings.colorScheme,
      colorMode: { defaultMode: mode, lightScheme, darkScheme },
    },
  };
}

function buildColorTab(mode: PanelMode): TabConfig {
  return {
    id: "color",
    label: "Color",
    tiers: [buildSemanticTier(mode)],
    colorExtras: buildColorExtras(mode),
  };
}

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

function detectInitialMode(): PanelMode {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
  }
  const cm = settings.colorMode;
  return cm ? cm.defaultMode : "light";
}

export function buildDesignTokenPanelConfig(mode: PanelMode): PanelConfig {
  return {
    storagePrefix: "sg-doc-tweak",
    consoleNamespace: "sgDoc",
    modalClassPrefix: "sg-doc-design-token-panel-modal",
    toggleEvent: "toggle-sg-doc-tweak",
    schemaId: "zudo-design-tokens/v3",
    exportFilenameBase: "sg-doc-design-tokens",
    tabs: [PALETTE_TAB, buildColorTab(mode), FONT_TAB, SPACING_TAB, SIZE_TAB],
  };
}

export const designTokenPanelConfig: PanelConfig = buildDesignTokenPanelConfig(
  detectInitialMode(),
);
