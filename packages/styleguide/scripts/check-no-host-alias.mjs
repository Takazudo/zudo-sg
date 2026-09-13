#!/usr/bin/env node
// Guard: @takazudo/zudo-sg must be self-contained. The host's `@/…` alias (a
// project tsconfig `paths` mapping to the host `src/`) does not exist for
// installed consumers, so an `@/` import under packages/styleguide/src would
// build inside this monorepo and break everywhere else. Host-only singletons
// belong in host modules that the package receives as input.
// Model: zudo-doc's scripts/check-no-host-alias-in-package.mjs.
//
// Usage: node scripts/check-no-host-alias.mjs   (exit 1 when a leak is found)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src", "bin", "routes-src"].map((d) => join(PKG_ROOT, d));
const SOURCE_EXT_RE = /\.(?:[cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set(["__tests__", "node_modules", "dist"]);

// Only real module specifiers: `from "@/…"`, bare `import "@/…"`,
// dynamic `import("@/…")`, `require("@/…")`.
const HOST_ALIAS_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'](@\/[^"']*)["']/g;

function collect(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (SOURCE_EXT_RE.test(name) && !/\.test\.[jt]sx?$/.test(name)) out.push(full);
  }
  return out;
}

// Blank comments (keeping offsets) so JSDoc examples showing host-side
// `@/` imports don't trip the guard.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

const files = SCAN_DIRS.flatMap(collect);
const offenders = [];
for (const file of files) {
  const src = stripComments(readFileSync(file, "utf8"));
  for (const m of src.matchAll(HOST_ALIAS_RE)) {
    const line = src.slice(0, m.index).split("\n").length;
    offenders.push(`  ${relative(PKG_ROOT, file)}:${line}  →  "${m[1]}"`);
  }
}

if (offenders.length > 0) {
  console.error("check:no-host-alias FAILED — @takazudo/zudo-sg must not import the host `@/` alias:");
  console.error(offenders.join("\n"));
  console.error("Use a package-relative import, or take the host value as an option/argument.");
  process.exit(1);
}
console.log(`OK — no host \`@/\` alias imports in @takazudo/zudo-sg (${files.length} source files scanned).`);
