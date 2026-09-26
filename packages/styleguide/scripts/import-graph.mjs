// Static import-graph walker over the compiled `dist/` ESM (bundle:false, so
// every relative import is a real file). Used to prove a subpath is
// framework-free (#880): `./preview/messages` must reach neither `preact`
// nor `preview/index`. Shared by scripts/check-package-shape.mjs and
// src/preview/__tests__/messages-dist-graph.test.ts.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// `import … from "x"`, `export … from "x"`, side-effect `import "x"`, and
// dynamic `import("x")`. Comments are stripped first so prose cannot match.
const SPECIFIER_RE =
  /\b(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
}

export function importSpecifiers(source) {
  const out = [];
  for (const match of stripComments(source).matchAll(SPECIFIER_RE)) {
    out.push(match[1] ?? match[2]);
  }
  return out;
}

/**
 * Walk every module reachable from `entryFile`. Returns the absolute paths of
 * the local files visited and every bare (package) specifier they import.
 */
export function collectImportGraph(entryFile) {
  const files = new Set();
  const bare = new Set();
  const missing = [];
  const queue = [resolve(entryFile)];
  while (queue.length > 0) {
    const file = queue.pop();
    if (files.has(file)) continue;
    if (!existsSync(file)) {
      missing.push(file);
      continue;
    }
    files.add(file);
    for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
      if (spec.startsWith(".") || spec.startsWith("/")) {
        queue.push(resolve(dirname(file), spec));
      } else {
        bare.add(spec);
      }
    }
  }
  return { files: [...files], bare: [...bare], missing };
}

/**
 * Violations of the framework-free contract for `entryFile`: any `preact`
 * (or `preact/*`) import, any path into `preview/index`, and any unresolved
 * relative import.
 */
export function frameworkFreeViolations(entryFile) {
  const { files, bare, missing } = collectImportGraph(entryFile);
  const violations = [];
  for (const spec of bare) {
    if (spec === "preact" || spec.startsWith("preact/")) {
      violations.push(`imports "${spec}"`);
    }
  }
  for (const file of files) {
    if (/[\\/]preview[\\/]index\.js$/.test(file)) {
      violations.push(`reaches ${file}`);
    }
  }
  for (const file of missing) violations.push(`imports missing file ${file}`);
  return violations;
}
