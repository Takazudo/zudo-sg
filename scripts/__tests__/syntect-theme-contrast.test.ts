import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "../../src/config/contrast-utils";

/**
 * Regression guard for the WCAG-AA syntect code themes (#169).
 *
 * `src/styles/syntect-themes/*.tmTheme` are base16-ocean with the sub-AA token
 * hues nudged to >=4.5:1 against each theme's own background (see
 * `codeHighlight` in zfb.config.ts). Nothing else guards that invariant: the
 * per-span token hex is baked by syntect at build time, so a stray edit to any
 * of the ~80 hexes would silently ship a sub-AA color that no other test or the
 * build would catch. This test parses each theme and asserts every *normal
 * text* token foreground clears WCAG-AA (4.5:1) on its background.
 *
 * "Normal text token" = a `settings` block with a `foreground` and NO sibling
 * `background`. Scopes that set their own `background` (the global editor
 * settings entry, plus the `invalid.*` badge scopes) are intentionally excluded
 * — their contrast is fg-vs-their-own-bg, a different (UI-component) concern
 * inherited unchanged from stock base16-ocean and out of scope for #169.
 */

const AA_NORMAL_TEXT = 4.5;
const themesDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/styles/syntect-themes",
);

// Each entry in a tmTheme `settings` array holds an inner `<key>settings</key>
// <dict>…</dict>` that contains only key/string pairs (no nested dict), so a
// non-greedy `</dict>` correctly closes it.
const SETTINGS_BLOCK = /<key>settings<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
const FOREGROUND = /<key>foreground<\/key>\s*<string>(#[0-9a-fA-F]{6,8})<\/string>/;
const BACKGROUND = /<key>background<\/key>\s*<string>(#[0-9a-fA-F]{6,8})<\/string>/;

function normalTextTokens(tmTheme: string): { bg: string; tokens: string[] } {
  const blocks = [...tmTheme.matchAll(SETTINGS_BLOCK)].map((m) => m[1]);
  // The first settings block is the global editor entry — its `background` is
  // the theme background every token sits on.
  const globalBg = blocks[0]?.match(BACKGROUND)?.[1];
  if (!globalBg) throw new Error("no global background found in theme");
  const tokens: string[] = [];
  for (const block of blocks) {
    const fg = block.match(FOREGROUND)?.[1];
    const hasOwnBg = BACKGROUND.test(block);
    if (fg && !hasOwnBg) tokens.push(fg.slice(0, 7)); // drop any alpha
  }
  return { bg: globalBg.slice(0, 7), tokens };
}

describe("syntect a11y themes — every normal text token is WCAG-AA", () => {
  for (const file of ["ocean-light-a11y.tmTheme", "ocean-dark-a11y.tmTheme"]) {
    it(`${file}: all foreground tokens >= ${AA_NORMAL_TEXT}:1 on the theme background`, () => {
      const { bg, tokens } = normalTextTokens(
        readFileSync(resolve(themesDir, file), "utf8"),
      );
      expect(tokens.length).toBeGreaterThan(0);
      const failing = tokens
        .map((fg) => ({ fg, ratio: contrastRatio(fg, bg) }))
        .filter((t) => t.ratio < AA_NORMAL_TEXT);
      expect(
        failing,
        `sub-AA tokens on ${bg}: ${failing
          .map((t) => `${t.fg} ${t.ratio.toFixed(2)}:1`)
          .join(", ")}`,
      ).toEqual([]);
    });
  }
});
