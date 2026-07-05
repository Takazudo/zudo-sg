#!/usr/bin/env node
// scripts/gen-token-manifest.mjs
//
// Codegen: regenerate src/config/ui-design-tokens-manifest.ts from the real
// source of truth — packages/ui/styles/tokens.css and
// packages/ui/styles/colors.css — instead of the ~450-line hand copy that
// used to live there (whose own header said its values "must be verified by
// hand" against those same two files, with nothing enforcing that).
//
// Parsing: uses postcss (scripts/lib/css-var-parser.mjs) to walk the real CSS
// AST rather than regex. The two source files are full of exactly the things
// that make regex fragile — `@theme { ... }` nesting, `light-dark(var(--a),
// var(--b))` pairs (commas inside parens), multi-layer `oklch(... / ...)`
// shadow values, and trailing same-line comments — postcss's declaration
// parser handles all of that structurally.
//
// What's generated vs. hand-configured: only each token's `default` value is
// derived from the CSS. `group` / `step` / `unit` / `control` / `options` /
// `pill` have no CSS equivalent (presentation metadata) and live in the
// SPECS tables in scripts/lib/ui-token-manifest.mjs — that's the one place a
// human edits when a genuinely new token needs to appear in the panel.
//
// NOT covered by this generator: src/config/design-tokens-manifest.ts (the
// ROOT host's own token manifest, sourced from src/styles/global.css). It was
// evaluated for the same treatment and left hand-maintained on purpose:
//   - Its font-size aliases (--text-micro, --text-body, ...) are themselves
//     `var(--text-scale-*)` references defined in a separate `:root` block,
//     so a faithful generator would need to resolve custom-property
//     indirection across two blocks, not just read a literal value.
//   - Its SPACING_TOKENS mixes tokens from THREE different sources: the
//     shared @zudo-sg/ui tokens.css (hsp/vsp, re-declared nowhere in
//     global.css — they're only *imported*), root-specific @theme overrides
//     (icon sizes, image-overlay-inset), and a raw `:root` clamp() value
//     (--zd-sidebar-w) that isn't a single-value token at all.
//   - Several root @theme values intentionally OVERRIDE the shared file
//     (e.g. --radius-lg: 1rem in tokens.css vs 0.5rem in global.css) — a
//     generator would need last-wins @theme-block resolution across two
//     files, which is a meaningfully different (and riskier) parser than
//     "read this one CSS file's declarations."
//   Given all three, generating it correctly needs a resolver, not a parser;
//   that's a bigger, separate effort. If it's worth doing, do it as its own
//   follow-up rather than folding it into this generator's simpler contract.
//
// Usage:
//   node scripts/gen-token-manifest.mjs           # rewrite the manifest
//   node scripts/gen-token-manifest.mjs --check   # verify committed file is
//                                                  # up to date (exit 1 on
//                                                  # drift, no write)
//
// MAINTENANCE: edit packages/ui/styles/tokens.css or colors.css (the source
// of truth) or the SPECS tables in scripts/lib/ui-token-manifest.mjs, then
// run `pnpm gen:token-manifest` and commit the regenerated manifest. Never
// hand-edit src/config/ui-design-tokens-manifest.ts.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildUiTokenManifest,
  renderUiTokenManifestFile,
} from "./lib/ui-token-manifest.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TOKENS_CSS_PATH = resolve(ROOT, "packages/ui/styles/tokens.css");
const COLORS_CSS_PATH = resolve(ROOT, "packages/ui/styles/colors.css");
const MANIFEST_PATH = resolve(ROOT, "src/config/ui-design-tokens-manifest.ts");

function main() {
  const check = process.argv.includes("--check");

  const tokensCss = readFileSync(TOKENS_CSS_PATH, "utf8");
  const colorsCss = readFileSync(COLORS_CSS_PATH, "utf8");
  const manifest = buildUiTokenManifest({ tokensCss, colorsCss });
  const next = renderUiTokenManifestFile(manifest);

  const tokenCount =
    manifest.paletteColors.length +
    manifest.colorTokens.length +
    manifest.spacingTokens.length +
    manifest.fontTokens.length +
    manifest.sizeTokens.length;

  if (check) {
    let current;
    try {
      current = readFileSync(MANIFEST_PATH, "utf8");
    } catch {
      current = null;
    }
    if (current !== next) {
      console.error(
        "Token manifest drift detected: src/config/ui-design-tokens-manifest.ts is out of date.",
      );
      console.error("Run `pnpm gen:token-manifest` and commit the result.");
      return 1;
    }
    console.log(`OK — token manifest is up to date (${tokenCount} entries).`);
    return 0;
  }

  let current = null;
  try {
    current = readFileSync(MANIFEST_PATH, "utf8");
  } catch {
    // First run — file doesn't exist yet.
  }
  if (current === next) {
    console.log(
      `Token manifest already up to date (${tokenCount} entries); no change.`,
    );
    return 0;
  }
  writeFileSync(MANIFEST_PATH, next);
  console.log(
    `Wrote src/config/ui-design-tokens-manifest.ts (${tokenCount} entries).`,
  );
  return 0;
}

process.exit(main());
