#!/usr/bin/env node
// scripts/gen-root-token-manifest.mjs
//
// Codegen (#211, wired in): regenerates src/config/design-tokens-manifest.ts
// — the ROOT host's own token manifest — from the real ROOT source of truth:
// src/styles/global.css and the two shared @zudo-sg/ui files it @imports, via
// the css-var-resolver.mjs cross-file resolver (#209). Replaces the hand copy
// scripts/gen-token-manifest.mjs's own header comment used to scope OUT of
// that generator's simpler single-file-parse contract (see #208/#210/#211).
//
// design-tokens-manifest.ts is a live consumer target (design-token-panel-config.ts,
// pages/components/tokens.tsx) — same treatment as scripts/gen-token-manifest.mjs /
// ui-design-tokens-manifest.ts.
//
// Usage:
//   node scripts/gen-root-token-manifest.mjs           # rewrite the manifest
//   node scripts/gen-root-token-manifest.mjs --check   # verify committed file is
//                                                        # up to date (exit 1 on
//                                                        # drift, no write)
//
// MAINTENANCE: edit src/styles/global.css / packages/ui/styles/{tokens,colors}.css
// (the source of truth) or the SPECS tables in scripts/lib/root-token-manifest.mjs,
// then run `pnpm gen:root-token-manifest` and commit the regenerated manifest.
// Never hand-edit src/config/design-tokens-manifest.ts.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCssVarResolver } from "./lib/css-var-resolver.mjs";
import {
  buildRootTokenManifest,
  renderRootTokenManifestFile,
} from "./lib/root-token-manifest.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TOKENS_CSS_PATH = resolve(ROOT, "packages/ui/styles/tokens.css");
const COLORS_CSS_PATH = resolve(ROOT, "packages/ui/styles/colors.css");
const GLOBAL_CSS_PATH = resolve(ROOT, "src/styles/global.css");
const MANIFEST_PATH = resolve(ROOT, "src/config/design-tokens-manifest.ts");

function main() {
  const check = process.argv.includes("--check");

  const tokensCss = readFileSync(TOKENS_CSS_PATH, "utf8");
  const colorsCss = readFileSync(COLORS_CSS_PATH, "utf8");
  const globalCss = readFileSync(GLOBAL_CSS_PATH, "utf8");

  // Source order MUST track the literal @import order in src/styles/global.css:
  //   global.css:21  @import "@zudo-sg/ui/styles/tokens.css"
  //   global.css:30  @import "@zudo-sg/ui/styles/colors.css"
  // global.css's own declarations (its @theme override block + :root block)
  // come after all of its @import lines — CSS requires @import to precede
  // other rules — and are supplied here as the LAST source, so they win on
  // collision (e.g. --radius-lg, --radius-DEFAULT, --leading-snug,
  // --spacing-icon-*), matching real cascade behavior for this project's
  // root-scoped, static-declaration-only tokens. If global.css's @import
  // lines are ever reordered or a new source file is added to the chain,
  // THIS ARRAY MUST BE UPDATED TO MATCH.
  const resolver = createCssVarResolver([
    { label: "packages/ui/styles/tokens.css", cssText: tokensCss },
    { label: "packages/ui/styles/colors.css", cssText: colorsCss },
    { label: "src/styles/global.css", cssText: globalCss },
  ]);

  const manifest = buildRootTokenManifest(resolver);
  const next = renderRootTokenManifestFile(manifest);

  const tokenCount =
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
        "Root token manifest drift detected: src/config/design-tokens-manifest.ts is out of date.",
      );
      console.error("Run `pnpm gen:root-token-manifest` and commit the result.");
      return 1;
    }
    console.log(`OK — root token manifest is up to date (${tokenCount} entries).`);
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
      `Root token manifest already up to date (${tokenCount} entries); no change.`,
    );
    return 0;
  }
  writeFileSync(MANIFEST_PATH, next);
  console.log(
    `Wrote src/config/design-tokens-manifest.ts (${tokenCount} entries).`,
  );
  return 0;
}

process.exit(main());
