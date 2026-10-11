// @vitest-environment node
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
    expect(
      existsSync(ENTRY),
      `${ENTRY} is missing — build the package first`,
    ).toBe(true);
  });

  it("resolves to neither preact nor preview/index", () => {
    const graph = collectImportGraph(ENTRY);
    expect(graph.missing).toEqual([]);
    expect(
      graph.bare.filter(
        (s: string) => s === "preact" || s.startsWith("preact/"),
      ),
    ).toEqual([]);
    expect(
      graph.bare.filter(
        (s: string) => s === "@takazudo/zfb" || s.includes("zudo-react"),
      ),
    ).toEqual([]);
    expect(
      graph.files.filter((f: string) => /[\\/]preview[\\/]index\.js$/.test(f)),
    ).toEqual([]);
    expect(frameworkFreeViolations(ENTRY)).toEqual([]);
  });

  it("detects a framework import and a path into preview/index when one exists", () => {
    const barrel = resolve(PKG_ROOT, "dist/preview/index.js");
    expect(collectImportGraph(barrel).bare).toContain(
      "@takazudo/zfb/zudo-react",
    );
    expect(
      frameworkFreeViolations(barrel).some((v: string) =>
        /preview[\\/]index\.js/.test(v),
      ),
    ).toBe(true);
    const temporary = mkdtempSync(resolve(tmpdir(), "sg-graph-"));
    try {
      const fixture = resolve(temporary, "framework.js");
      writeFileSync(fixture, 'import "preact";');
      expect(frameworkFreeViolations(fixture)).toContain('imports "preact"');
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});
