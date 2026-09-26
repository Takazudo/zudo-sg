#!/usr/bin/env node
// Guard: the published shape of @takazudo/zudo-sg (ADR
// docs/adr/styleguide-engine.md decisions 2 and 11).
//   1. Every literal `exports` target exists on disk (run after `build`:
//      `./dist/**` targets are build output). Wildcard targets are skipped.
//   2. Every `exports` condition object lists `types` before `default`.
//   3. `files` covers the package boundary entries.
//   4. Required subpaths are exported, and the framework-free ones import
//      neither `preact` nor `preview/index` anywhere in their graph (#880).
//
// Usage: node scripts/check-package-shape.mjs   (exit 1 on any violation)

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { frameworkFreeViolations } from "./import-graph.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8"));

// `CHANGELOG.md` / `README.md` joined this list when the package went public (#668).
const REQUIRED_FILES = ["dist", "bin", "routes-src", "virtual-modules.d.ts", "styles.css", "CHANGELOG.md", "README.md"];

// Subpaths a foreign-framework host depends on; each maps to the dist entry
// whose import graph must stay framework-free.
const FRAMEWORK_FREE_EXPORTS = {
  "./preview/messages": "./dist/preview/messages.js",
};

const errors = [];

function walk(subpath, node) {
  if (typeof node === "string") {
    if (!node.startsWith("./")) errors.push(`exports["${subpath}"] target "${node}" must start with "./"`);
    else if (!node.includes("*") && !existsSync(join(PKG_ROOT, node))) {
      errors.push(`exports["${subpath}"] target "${node}" does not exist (run the package build first)`);
    }
    return;
  }
  if (node && typeof node === "object") {
    const keys = Object.keys(node);
    if (keys.includes("types") && keys.includes("default") && keys.indexOf("types") > keys.indexOf("default")) {
      errors.push(`exports["${subpath}"] must list "types" before "default"`);
    }
    for (const value of Object.values(node)) walk(subpath, value);
    return;
  }
  errors.push(`exports["${subpath}"] has an invalid target`);
}

if (!manifest.exports || typeof manifest.exports !== "object") {
  errors.push("package.json has no exports map");
} else {
  for (const [subpath, target] of Object.entries(manifest.exports)) walk(subpath, target);
}

for (const [subpath, entry] of Object.entries(FRAMEWORK_FREE_EXPORTS)) {
  const target = manifest.exports?.[subpath];
  if (!target || typeof target !== "object" || target.default !== entry) {
    errors.push(`exports["${subpath}"] must exist with default "${entry}"`);
    continue;
  }
  const abs = join(PKG_ROOT, entry);
  if (!existsSync(abs)) continue; // already reported by the target walk above
  for (const violation of frameworkFreeViolations(abs)) {
    errors.push(`exports["${subpath}"] must be framework-free, but its import graph ${violation}`);
  }
}

const files = Array.isArray(manifest.files) ? manifest.files : [];
for (const entry of REQUIRED_FILES) {
  if (!files.includes(entry)) errors.push(`files is missing "${entry}"`);
}

if (errors.length > 0) {
  console.error("check:package-shape FAILED for @takazudo/zudo-sg:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const count = Object.keys(manifest.exports).length;
console.log(
  `OK — @takazudo/zudo-sg package shape (${count} exports resolved, files covers ${REQUIRED_FILES.join(" ")}, framework-free: ${Object.keys(FRAMEWORK_FREE_EXPORTS).join(" ")}).`,
);
