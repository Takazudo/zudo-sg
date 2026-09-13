#!/usr/bin/env node
// Guard for the generated `routes-src/` tree (run after the package build).
// Model: zudo-doc's scripts/check-routes-src.mjs.
//   1. IN SYNC   — routes-src/ holds exactly the mirror of src/routes/*.{ts,tsx}
//                  (minus .d.ts / tests), byte-equal to a fresh rewrite.
//   2. ENTRIES   — every entrypoint plugins/routes.ts injects is present.
//   3. HYGIENE   — no parent-relative import survives (semantic match on
//                  import/export specifier syntax, not a `../` text grep).
//   4. EXPORTS   — every `@takazudo/zudo-sg/*` specifier is a key of the
//                  package `exports` map (a dangling subpath breaks consumers).
//
// Usage: node scripts/check-routes-src.mjs   (exit 1 on any violation)

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteImports } from "./copy-routes-src.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROUTES = join(PKG_ROOT, "src", "routes");
const ROUTES_SRC = join(PKG_ROOT, "routes-src");
const PKG_NAME = "@takazudo/zudo-sg";

// ROUTE_ENTRYPOINTS in src/plugins/routes.ts, plus the preview island wrapper
// that src/islands.ts imports through `../routes-src/_preview-app.tsx`.
const REQUIRED_ENTRYPOINTS = [
  "components-index.tsx",
  "components-slug.tsx",
  "components-preview.tsx",
  "tokens.tsx",
  "_preview-app.tsx",
];

const RESIDUAL_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])\.\.\/[^"']*\1/;
const PKG_SPECIFIER_RE = new RegExp(
  String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(${PKG_NAME.replace("/", "\\/")}\/[^"']+)\1`,
  "g",
);

const errors = [];

function listSources(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts") && !/\.test\.tsx?$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

let files = [];
try {
  files = listSources(ROUTES_SRC);
} catch {
  console.error(
    "[check-routes-src] ERROR: routes-src/ is missing — run `pnpm --filter @takazudo/zudo-sg build` first.",
  );
  process.exit(1);
}

const expected = listSources(SRC_ROUTES);
for (const name of expected) {
  if (!files.includes(name)) {
    errors.push(`routes-src/${name} is missing (src/routes/${name} exists)`);
    continue;
  }
  const mirrored = rewriteImports(readFileSync(join(SRC_ROUTES, name), "utf8"));
  if (readFileSync(join(ROUTES_SRC, name), "utf8") !== mirrored) {
    errors.push(`routes-src/${name} is out of sync with src/routes/${name}`);
  }
}
for (const name of files) {
  if (!expected.includes(name)) errors.push(`routes-src/${name} has no src/routes/ source (stale file)`);
}
for (const name of REQUIRED_ENTRYPOINTS) {
  if (!files.includes(name)) errors.push(`routes-src/${name} is missing — plugins/routes.ts injects it`);
}

const exportKeys = new Set(
  Object.keys(JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).exports ?? {}),
);
for (const name of files) {
  const lines = readFileSync(join(ROUTES_SRC, name), "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (RESIDUAL_RE.test(line)) errors.push(`routes-src/${name}:${i + 1} residual parent-relative import: ${line.trim()}`);
    for (const m of line.matchAll(PKG_SPECIFIER_RE)) {
      const subpath = `.${m[2].slice(PKG_NAME.length)}`;
      if (!exportKeys.has(subpath)) {
        errors.push(`routes-src/${name}:${i + 1} imports "${m[2]}", which is not in package.json exports`);
      }
    }
  });
}

if (errors.length > 0) {
  console.error("check:routes-src FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `OK — routes-src/ in sync (${files.length} files, ${REQUIRED_ENTRYPOINTS.length} entrypoints, 0 residual ../ imports).`,
);
