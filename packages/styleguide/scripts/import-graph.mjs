// Static import-graph walker over the compiled `dist/` ESM (bundle:false, so
// every relative import is a real file). Used to prove a subpath is
// framework-free (#880): `./preview/messages` must reach neither `preact`
// nor `preview/index`. Shared by scripts/check-package-shape.mjs and
// src/preview/__tests__/messages-dist-graph.test.ts.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

// Parse actual import/export syntax. A regex also treats the runtime error
// code in ["import", "render"] as an import of ", ", corrupting the graph.
export function importSpecifiers(source) {
  const out = [];
  const file = ts.createSourceFile("module.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      out.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      out.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
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
    if (spec === "preact" || spec.startsWith("preact/") || spec === "react" || spec.startsWith("react/") ||
      spec === "react-dom" || spec.startsWith("react-dom/") || spec === "@takazudo/zfb" || spec.includes("zudo-react")) {
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
