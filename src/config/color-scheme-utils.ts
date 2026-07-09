/**
 * Project-side color-scheme helpers.
 *
 * The ramp-to-CSS mechanism lives in @takazudo/zudo-doc. This file re-exports
 * those mechanism symbols and keeps the project-specific wrappers that resolve
 * this repo's `colorSchemes` map and `settings`.
 */

export {
  type OKLCH,
  type StateRole,
  type SemanticKey,
  type RampRef,
  type Ramps,
  type ModeMap,
  type ColorScheme,
  type CssEmitScope,
  STATE_ROLES,
  SEMANTIC_KEYS,
  SEMANTIC_RAMP_DEFAULTS,
  SEMANTIC_CSS_NAMES,
  resolveRampRef,
  resolveSemanticColors,
  rampRefToPanelDefault,
  buildSemanticTierItems,
  schemeToCssPairs,
  generateCssCustomProperties as generateCssCustomPropertiesFromScheme,
  generateLightDarkCssProperties as generateLightDarkCssPropertiesFromSchemes,
} from "@takazudo/zudo-doc/color-scheme-utils";
import {
  generateCssCustomProperties as generateCssCustomPropertiesFromScheme,
  generateLightDarkCssProperties as generateLightDarkCssPropertiesFromSchemes,
} from "@takazudo/zudo-doc/color-scheme-utils";

import { colorSchemes } from "./color-schemes";
import { settings } from "./settings";

export const lightDarkPairings = [
  { light: "Default Light", dark: "Default Dark", label: "Default" },
];

export function getActiveScheme() {
  const scheme = colorSchemes[settings.colorScheme];
  if (!scheme) {
    throw new Error(`Unknown color scheme: "${settings.colorScheme}". Available: ${Object.keys(colorSchemes).join(", ")}`);
  }
  return scheme;
}

export function generateCssCustomProperties(): string {
  return generateCssCustomPropertiesFromScheme(getActiveScheme());
}

export function generateLightDarkCssProperties(): string {
  if (!settings.colorMode) {
    throw new Error("colorMode is not configured");
  }
  const { lightScheme, darkScheme } = settings.colorMode;
  const light = colorSchemes[lightScheme];
  const dark = colorSchemes[darkScheme];
  if (!light) throw new Error(`Unknown light scheme: "${lightScheme}"`);
  if (!dark) throw new Error(`Unknown dark scheme: "${darkScheme}"`);
  return generateLightDarkCssPropertiesFromSchemes(light, dark);
}
