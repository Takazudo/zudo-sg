// @vitest-environment node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Runs against the BUILT package: `pnpm --filter @takazudo/zudo-sg check`
// builds before testing, and the root `test:unit` runs
// scripts/ensure-styleguide-build.mjs first.
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTRY = resolve(PKG_ROOT, "dist/preview/messages.js");

const { collectImportGraph, frameworkFreeViolations } = await import(
  resolve(PKG_ROOT, "scripts/import-graph.mjs")
);

describe("dist/preview/messages.js import graph (#880)", () => {
  it("exists after the package build", () => {
    expect(existsSync(ENTRY), `${ENTRY} is missing — build the package first`).toBe(true);
  });

  it("resolves to neither preact nor preview/index", () => {
    const graph = collectImportGraph(ENTRY);
    expect(graph.missing).toEqual([]);
    expect(graph.bare.filter((s: string) => s === "preact" || s.startsWith("preact/"))).toEqual([]);
    expect(graph.files.filter((f: string) => /[\\/]preview[\\/]index\.js$/.test(f))).toEqual([]);
    expect(frameworkFreeViolations(ENTRY)).toEqual([]);
  });

  it("detects a preact import and a path into preview/index when one exists", () => {
    // Guard against a walker that silently finds nothing: the Preact-based
    // preview barrel must trip both rules.
    const violations = frameworkFreeViolations(resolve(PKG_ROOT, "dist/preview/index.js"));
    expect(violations.some((v: string) => v.includes('"preact'))).toBe(true);
    expect(violations.some((v: string) => /preview[\\/]index\.js/.test(v))).toBe(true);
  });
});
