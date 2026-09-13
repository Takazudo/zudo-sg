#!/usr/bin/env node
// Generates the package-root `virtual-modules.d.ts` from
// `src/routes/_virtual.d.ts`, rewriting parent-relative `import("../…")` type
// specifiers to bare `@takazudo/zudo-sg/*` subpaths (same mapping as
// copy-routes-src.mjs). Runs in the tsup `onSuccess` chain; the output is
// gitignored and published via `files`. Edit the source, never the output.
// Model: zudo-doc's scripts/copy-virtual-modules.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteImports } from "./copy-routes-src.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(PKG_ROOT, "src", "routes", "_virtual.d.ts");
const DEST = join(PKG_ROOT, "virtual-modules.d.ts");

const BANNER = `// GENERATED FILE — DO NOT EDIT.
// Built from src/routes/_virtual.d.ts by scripts/copy-virtual-modules.mjs
// (tsup onSuccess). Host code importing virtual:zudo-sg-context /
// virtual:zudo-sg-registry typechecks by referencing this file.

`;

let source;
try {
  source = readFileSync(SRC, "utf8");
} catch {
  console.error("[copy-virtual-modules] ERROR: src/routes/_virtual.d.ts is missing.");
  process.exit(1);
}

const rewritten = rewriteImports(source);
if (/import\s*\(\s*["']\.\.\//.test(rewritten)) {
  console.error("[copy-virtual-modules] ERROR: a parent-relative import(...) survived the rewrite.");
  process.exit(1);
}
writeFileSync(DEST, BANNER + rewritten, "utf8");
console.log(`[copy-virtual-modules] virtual-modules.d.ts OK`);
