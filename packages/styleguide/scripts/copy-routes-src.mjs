#!/usr/bin/env node
// Mirrors `src/routes/*.{ts,tsx}` → `routes-src/` (ADR
// docs/adr/styleguide-engine.md decision 2), rewriting parent-relative imports
// to bare `@takazudo/zudo-sg/*` specifiers. Runs in the tsup `onSuccess` chain.
// Model: zudo-doc's scripts/copy-routes-src.mjs.
//
// Why `.tsx` source: zfb extracts a dynamic route's `paths()` by AST from the
// injected source file; a compiled `.js` fails with "no top-level `paths`
// export". Why the rewrite: the published tarball ships no `src/`, so every
// `../…` specifier would dangle — the bare subpath resolves through the
// consumer's node_modules (or the workspace self-reference).
//
//   ../<seg>/index.js      → @takazudo/zudo-sg/<seg>
//   ../<seg>/<rest>.js     → @takazudo/zudo-sg/<seg>/<rest>
//   ../<file>.js           → @takazudo/zudo-sg/<file>
//
// Same-dir relatives (`./_context.js`) and `virtual:` specifiers stay as-is.
// scripts/check-routes-src.mjs verifies every rewritten specifier is a real
// `exports` entry. `routes-src/` is wiped and recreated on every run.

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROUTES = join(PKG_ROOT, "src", "routes");
const DEST_ROUTES = join(PKG_ROOT, "routes-src");
const PKG_NAME = "@takazudo/zudo-sg";

// `from "…"`, dynamic `import("…")`, bare side-effect `import "…"`.
const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.\/[^"']+)\2/g;

/** Maps one parent-relative specifier to its package subpath. */
export function toPackageSpecifier(specifier) {
  const rest = specifier.replace(/^\.\.\//, "").replace(/\.[cm]?[jt]sx?$/, "");
  const subpath = rest.replace(/\/index$/, "");
  return `${PKG_NAME}/${subpath}`;
}

export function rewriteImports(code) {
  return code.replace(SPECIFIER_RE, (_m, head, q, spec) => `${head}${q}${toPackageSpecifier(spec)}${q}`);
}

function main() {
  try {
    statSync(SRC_ROUTES);
  } catch {
    console.error("[copy-routes-src] ERROR: src/routes/ is missing — cannot build routes-src/.");
    process.exit(1);
  }

  rmSync(DEST_ROUTES, { recursive: true, force: true });
  mkdirSync(DEST_ROUTES, { recursive: true });

  let copied = 0;
  let rewritten = 0;
  for (const entry of readdirSync(SRC_ROUTES, { withFileTypes: true })) {
    const name = entry.name;
    if (!entry.isFile() || !/\.tsx?$/.test(name)) continue;
    if (name.endsWith(".d.ts") || /\.test\.tsx?$/.test(name)) continue;
    const original = readFileSync(join(SRC_ROUTES, name), "utf8");
    const transformed = rewriteImports(original);
    writeFileSync(join(DEST_ROUTES, name), transformed, "utf8");
    copied++;
    if (transformed !== original) rewritten++;
  }

  if (copied === 0) {
    console.error("[copy-routes-src] ERROR: no route source files copied from src/routes/.");
    process.exit(1);
  }
  console.log(`[copy-routes-src] routes-src/ OK (${copied} files, ${rewritten} rewritten)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
