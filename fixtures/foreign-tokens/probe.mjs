import assert from "node:assert/strict";
import * as generated from "./src/styleguide/token-manifest.ts";
import { buildUiTokenTabs } from "@takazudo/zudo-sg/token-dashboard";
import { createPreviewTokenPanelConfig } from "@takazudo/zudo-sg/token-tweak";
import { assertValidPanelConfig } from "@takazudo/zdtp";

const manifest = {
  paletteColors: generated.UI_PALETTE_COLORS,
  colorTokens: generated.UI_COLOR_TOKENS,
  spacingTokens: generated.UI_SPACING_TOKENS,
  fontTokens: generated.UI_FONT_TOKENS,
  sizeTokens: generated.UI_SIZE_TOKENS,
  groups: generated.UI_TOKEN_GROUPS,
};
const tabs = buildUiTokenTabs(manifest);
assertValidPanelConfig(createPreviewTokenPanelConfig({ tabs }));
assert.deepEqual(tabs.map((tab) => tab.id), ["ui-color", "ui-palette", "ui-spacing", "ui-font", "ui-size"]);
const palette = tabs[1];
assert.deepEqual(palette.tiers.map((tier) => tier.label), ["Brand", "Signals"]);
assert.deepEqual(palette.tiers.flatMap((tier) => tier.items.map((item) => item.cssVar)), ["--brand-100", "--brand-500", "--signal-calm", "--status-alert"]);
assert.equal(palette.tiers[0].items[0].id, "pale-brand");
assert.equal(palette.tiers[0].items[0].label, "Brand pale");
assert.equal(palette.tiers[0].items[1].readonly, true);
const spacing = tabs[2].tiers[0];
assert.equal(spacing.preview, "bar");
assert.deepEqual(spacing.items[0].type.units, ["rem", "px"]);
const leading = tabs[3].tiers[1];
assert.equal(leading.previewBase, "--type-body");
assert.equal(leading.items[0].type.kind, "number");
assert.deepEqual(tabs[3].tiers[2].items[0].type.options, ["350", "550", "750"]);
assert.equal(tabs[4].tiers[0].preview, "radius");
assert.equal(generated.UI_COLOR_TOKENS[0].default, "light-dark(var(--brand-100), var(--brand-500))");
assert(!tabs.some((tab) => tab.tiers.some((tier) => tier.items.some((item) => item.cssVar.startsWith("--palette-") || item.cssVar === "--text-base"))));
console.log("OK — foreign generated module imports, panel config validates, and host controls/groups/defaults survive.");
