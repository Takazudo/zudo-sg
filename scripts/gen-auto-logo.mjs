#!/usr/bin/env node
// scripts/gen-auto-logo.mjs
//
// Materialize zudo-doc's deterministic generated logo and favicon assets.
// The generated strings are intentionally written unchanged so this script is
// byte-stable and can be rerun whenever the upstream renderer changes.

import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderAutoLogoStandaloneSvg,
  renderAutoLogoIconSvg,
} from "@takazudo/zudo-doc/auto-logo";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Keep this in sync with settings.siteName in src/config/settings.ts. A plain
// Node script cannot import that TypeScript module without a TS runtime.
const SEED = "zudo-sg";

const OUTPUTS = [
  ["public/img/logo.svg", renderAutoLogoStandaloneSvg],
  ["public/favicon.svg", renderAutoLogoIconSvg],
];

await Promise.all(
  OUTPUTS.map(async ([relativePath, render]) => {
    const outputPath = resolve(ROOT, relativePath);
    await writeFile(outputPath, render(SEED), "utf8");
    console.log(`Wrote ${relativePath} (seed "${SEED}")`);
  }),
);
