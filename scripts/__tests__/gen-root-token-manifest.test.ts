// scripts/__tests__/gen-root-token-manifest.test.ts
//
// Integration tests for #210's root token-manifest builder — the
// generate-only counterpart to scripts/__tests__/ui-token-manifest.test.ts,
// but resolver-backed (#209) across the three real ROOT sources instead of a
// single-file Map lookup.
//
// Two layers, both against the REAL project CSS (no synthetic fixtures):
//  - Library level: build/render straight from the real
//    packages/ui/styles/{tokens,colors}.css + src/styles/global.css content,
//    asserting the known unit-transform cases (#210's LOCKED spec) and that
//    the render is idempotent against the committed scratch file.
//  - CLI level: spawns the real gen-root-token-manifest.mjs (copied, with its
//    lib/ dependencies, into a temp sandbox — same pattern as
//    gen-z-index.test.ts) against sandbox CSS files seeded with the REAL
//    project CSS content, so --check's drift/no-write behavior is exercised
//    without touching the real repo's committed generated file.

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCssVarResolver } from "../lib/css-var-resolver.mjs";
import {
  buildRootTokenManifest,
  normalizeToUnit,
  renderRootTokenManifestFile,
} from "../lib/root-token-manifest.mjs";

// Avoid the `new URL(literal, import.meta.url)` shape — Vite's static asset
// transform rewrites that exact pattern into a served-asset URL even in
// vitest's SSR transform, which breaks plain file-path resolution here (see
// gen-z-index.test.ts for the same note).
const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(THIS_DIR, "..", "..");

const TOKENS_CSS_PATH = join(PROJECT_ROOT, "packages", "ui", "styles", "tokens.css");
const COLORS_CSS_PATH = join(PROJECT_ROOT, "packages", "ui", "styles", "colors.css");
const GLOBAL_CSS_PATH = join(PROJECT_ROOT, "src", "styles", "global.css");
const GENERATED_MANIFEST_PATH = join(
  PROJECT_ROOT,
  "src",
  "config",
  "root-token-manifest.generated.ts",
);

function realResolver() {
  return createCssVarResolver([
    { label: "packages/ui/styles/tokens.css", cssText: readFileSync(TOKENS_CSS_PATH, "utf8") },
    { label: "packages/ui/styles/colors.css", cssText: readFileSync(COLORS_CSS_PATH, "utf8") },
    { label: "src/styles/global.css", cssText: readFileSync(GLOBAL_CSS_PATH, "utf8") },
  ]);
}

describe("normalizeToUnit", () => {
  it("converts rem to px at 16px/rem when the target unit is px", () => {
    expect(normalizeToUnit("0.5rem", "px")).toBe("8px");
    expect(normalizeToUnit("0.25rem", "px")).toBe("4px");
  });

  it("converts s to ms when the target unit is ms", () => {
    expect(normalizeToUnit("0.15s", "ms")).toBe("150ms");
  });

  it("passes through a value already in the target unit", () => {
    expect(normalizeToUnit("9999px", "px")).toBe("9999px");
    expect(normalizeToUnit("150ms", "ms")).toBe("150ms");
  });

  it("does not mistake an ms value for a seconds value", () => {
    // A naive `/s$/` match would wrongly re-scale an already-ms literal.
    expect(normalizeToUnit("150ms", "ms")).toBe("150ms");
  });

  it("passes through rem values when the target unit is rem (no transform)", () => {
    expect(normalizeToUnit("1.25rem", "rem")).toBe("1.25rem");
  });

  it("passes through unitless literals and raw strings unchanged", () => {
    expect(normalizeToUnit("1.75", "")).toBe("1.75");
    expect(normalizeToUnit("400", "")).toBe("400");
    expect(normalizeToUnit("ui-monospace, monospace", "")).toBe("ui-monospace, monospace");
  });
});

describe("buildRootTokenManifest (real CSS sources)", () => {
  it("resolves the known radius/duration unit-transform cases from the real CSS", () => {
    const manifest = buildRootTokenManifest(realResolver());

    // --radius-lg: shared tokens.css declares 1rem, but global.css's root
    // @theme override wins (0.5rem) — normalized to px per the LOCKED spec.
    expect(manifest.sizeTokens.find((t) => t.cssVar === "--radius-lg")).toMatchObject({
      id: "radius-lg",
      default: "8px",
      unit: "px",
    });

    // --radius-DEFAULT: global.css @theme, 0.25rem -> 4px.
    expect(manifest.sizeTokens.find((t) => t.cssVar === "--radius-DEFAULT")).toMatchObject({
      id: "radius-DEFAULT",
      default: "4px",
      unit: "px",
    });

    // --default-transition-duration: shared tokens.css, 0.15s -> 150ms.
    expect(
      manifest.sizeTokens.find((t) => t.cssVar === "--default-transition-duration"),
    ).toMatchObject({
      id: "default-transition-duration",
      default: "150ms",
      unit: "ms",
    });
  });

  it("resolves --text-body through its whole-value var() chain onto the shared Tier 1 scale", () => {
    const manifest = buildRootTokenManifest(realResolver());

    // --text-body: var(--text-lg) in tokens.css; --text-lg: 1.25rem — no unit
    // transform fires since the target unit is rem (font sizes stay rem).
    expect(manifest.fontTokens.find((t) => t.cssVar === "--text-body")).toMatchObject({
      id: "text-body",
      default: "1.25rem",
      unit: "rem",
    });
  });

  it("keeps COLOR_TOKENS empty (v1) even though real CSS sources are supplied", () => {
    const manifest = buildRootTokenManifest(realResolver());
    expect(manifest.colorTokens).toEqual([]);
  });

  it("carries --zd-sidebar-w as a manual readonly literal, not resolved from CSS", () => {
    const manifest = buildRootTokenManifest(realResolver());
    expect(manifest.spacingTokens.find((t) => t.cssVar === "--zd-sidebar-w")).toMatchObject({
      id: "sidebar-w",
      default: "clamp(14rem, 20vw, 22rem)",
      readonly: true,
    });
  });

  it("keeps the spacing-0 / spacing-px ids at their full name, not stripped like axis rows", () => {
    const manifest = buildRootTokenManifest(realResolver());
    expect(manifest.spacingTokens.find((t) => t.cssVar === "--spacing-0")).toMatchObject({
      id: "spacing-0",
      label: "spacing-0",
      default: "0",
    });
    expect(manifest.spacingTokens.find((t) => t.cssVar === "--spacing-px")).toMatchObject({
      id: "spacing-px",
      label: "spacing-px",
      default: "1px",
    });
  });

  it("throws a clear error when a spec'd cssVar is missing from every source", () => {
    const emptyResolver = createCssVarResolver([{ label: "empty", cssText: `:root {}` }]);
    expect(() => buildRootTokenManifest(emptyResolver)).toThrow(/--spacing-hsp-2xs/);
  });
});

describe("renderRootTokenManifestFile", () => {
  it("is idempotent and matches the committed scratch manifest for the real project CSS", () => {
    const manifest = buildRootTokenManifest(realResolver());
    const rendered = renderRootTokenManifestFile(manifest);
    const committed = readFileSync(GENERATED_MANIFEST_PATH, "utf8");

    // Same assertion `node scripts/gen-root-token-manifest.mjs --check` makes
    // — kept here too so `pnpm test:unit` catches drift as well.
    expect(rendered).toBe(committed);
  });
});

// ---------------------------------------------------------------------------
// CLI: spawns the real script (with its lib/ deps) in a temp sandbox seeded
// with the REAL project CSS content, so --check's write/no-write and
// exit-code behavior is exercised hermetically.
// ---------------------------------------------------------------------------

const SCRIPT_SRC = join(THIS_DIR, "..", "gen-root-token-manifest.mjs");
const LIB_DIR = join(THIS_DIR, "..", "lib");

let sandbox: string;

beforeEach(() => {
  // Nested under the project's own node_modules/ (always gitignored) rather
  // than os.tmpdir(): the sandboxed script still imports the bare specifier
  // "postcss" via css-var-parser.mjs, and Node's ESM resolver walks UP from
  // the importing file looking for a node_modules/postcss — a /tmp sandbox
  // has no ancestor node_modules and fails with ERR_MODULE_NOT_FOUND, while
  // this path's walk-up reaches the real project's node_modules/postcss.
  const sandboxParent = join(PROJECT_ROOT, "node_modules", ".gen-root-token-manifest-test");
  mkdirSync(sandboxParent, { recursive: true });
  sandbox = mkdtempSync(join(sandboxParent, "sandbox-"));
  mkdirSync(join(sandbox, "scripts", "lib"), { recursive: true });
  mkdirSync(join(sandbox, "packages", "ui", "styles"), { recursive: true });
  mkdirSync(join(sandbox, "src", "styles"), { recursive: true });
  mkdirSync(join(sandbox, "src", "config"), { recursive: true });

  copyFileSync(SCRIPT_SRC, join(sandbox, "scripts", "gen-root-token-manifest.mjs"));
  copyFileSync(join(LIB_DIR, "css-var-parser.mjs"), join(sandbox, "scripts", "lib", "css-var-parser.mjs"));
  copyFileSync(join(LIB_DIR, "css-var-resolver.mjs"), join(sandbox, "scripts", "lib", "css-var-resolver.mjs"));
  copyFileSync(join(LIB_DIR, "root-token-manifest.mjs"), join(sandbox, "scripts", "lib", "root-token-manifest.mjs"));

  // Seed with the REAL project CSS content (not synthetic fixtures) so the
  // sandbox run resolves the same values the library-level tests assert.
  writeFileSync(
    join(sandbox, "packages", "ui", "styles", "tokens.css"),
    readFileSync(TOKENS_CSS_PATH, "utf8"),
  );
  writeFileSync(
    join(sandbox, "packages", "ui", "styles", "colors.css"),
    readFileSync(COLORS_CSS_PATH, "utf8"),
  );
  writeFileSync(join(sandbox, "src", "styles", "global.css"), readFileSync(GLOBAL_CSS_PATH, "utf8"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function run(args: string[] = []) {
  return spawnSync(process.execPath, [join(sandbox, "scripts", "gen-root-token-manifest.mjs"), ...args], {
    cwd: sandbox,
    encoding: "utf-8",
  });
}

function readGenerated() {
  return readFileSync(join(sandbox, "src", "config", "root-token-manifest.generated.ts"), "utf-8");
}

describe("gen-root-token-manifest.mjs CLI", () => {
  it("writes the scratch manifest with the known unit-transform defaults on first run", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Wrote src/config/root-token-manifest.generated.ts");

    const generated = readGenerated();
    expect(generated).toContain('default: "8px"'); // --radius-lg
    expect(generated).toContain('default: "4px"'); // --radius-DEFAULT
    expect(generated).toContain('default: "150ms"'); // --default-transition-duration
    expect(generated).toContain('default: "1.25rem"'); // --text-body
    expect(generated).toContain("export const COLOR_TOKENS: readonly TokenDef[] = [];");
  });

  it("is idempotent: a second run reports no change", () => {
    run();
    const second = run();
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("already up to date");
    expect(second.stdout).toContain("no change");
  });

  it("--check passes and does not write when the committed file matches", () => {
    run();
    const before = readGenerated();

    const result = run(["--check"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK — root token manifest is up to date");
    expect(readGenerated()).toBe(before);
  });

  it("--check fails and does not write when the committed file has drifted", () => {
    run();
    const stale = readGenerated().replace('"radius-lg"', '"radius-lg-STALE"');
    writeFileSync(join(sandbox, "src", "config", "root-token-manifest.generated.ts"), stale);

    const result = run(["--check"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Root token manifest drift detected");
    // --check must not write — the stale content is untouched.
    expect(readGenerated()).toBe(stale);
  });

  it("--check fails without writing when the scratch file doesn't exist yet", () => {
    const result = run(["--check"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Root token manifest drift detected");
  });
});
