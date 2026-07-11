// Spawns the real gen-z-index.mjs as a child process against a temp sandbox.
// The script derives TOKENS_PATH/CSS_PATH from its own file location
// (import.meta.url), so we copy it into a fresh temp dir with its own
// src/config + src/styles fixtures per test — hermetic, no network, and the
// real project's global.css is never touched.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Avoid the `new URL(literal, import.meta.url)` shape — Vite's static asset
// transform rewrites that exact pattern into a served-asset URL even in
// vitest's SSR transform, which breaks plain file-path resolution here.
const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_SRC = join(THIS_DIR, "..", "gen-z-index.mjs");

const TOKENS_SRC = `export const Z_INDEX_TIERS = [
  { name: "base", value: 0 },
  { name: "toolbar", value: 20 },
  { name: "modal", value: 40 },
];
`;

const UP_TO_DATE_CSS = `:root {
  --foo: 1;
}

  /* GENERATED:Z_INDEX_BEGIN
   * GENERATED:Z_INDEX — do not hand-edit; run pnpm gen:z-index.
   * Source of truth: src/config/z-index-tokens.ts. Tailwind v4 reads the
   * --z-index-<name> theme key and generates a z-<name> utility. */
  @theme {
    --z-index-base: 0;
    --z-index-toolbar: 20;
    --z-index-modal: 40;
  }
  /* GENERATED:Z_INDEX_END */

:root {
  --bar: 2;
}
`;

const STALE_CSS = `:root {
  --foo: 1;
}

  /* GENERATED:Z_INDEX_BEGIN
   * stale */
  @theme {
    --z-index-old: 1;
  }
  /* GENERATED:Z_INDEX_END */

:root {
  --bar: 2;
}
`;

const NO_MARKERS_CSS = `:root {
  --foo: 1;
}
`;

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "gen-z-index-"));
  mkdirSync(join(sandbox, "scripts"), { recursive: true });
  mkdirSync(join(sandbox, "src", "config"), { recursive: true });
  mkdirSync(join(sandbox, "src", "styles"), { recursive: true });
  copyFileSync(SCRIPT_SRC, join(sandbox, "scripts", "gen-z-index.mjs"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function writeTokens(content: string) {
  writeFileSync(join(sandbox, "src", "config", "z-index-tokens.ts"), content);
}

function writeCss(content: string) {
  writeFileSync(join(sandbox, "src", "styles", "global.css"), content);
}

function readCss() {
  return readFileSync(join(sandbox, "src", "styles", "global.css"), "utf-8");
}

function run(args: string[] = []) {
  return spawnSync(process.execPath, [join(sandbox, "scripts", "gen-z-index.mjs"), ...args], {
    cwd: sandbox,
    encoding: "utf-8",
  });
}

describe("gen-z-index.mjs", () => {
  it("rewrites a stale block from the tokens source of truth", () => {
    writeTokens(TOKENS_SRC);
    writeCss(STALE_CSS);

    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Wrote z-index @theme block");

    const css = readCss();
    expect(css).toContain("--z-index-base: 0;");
    expect(css).toContain("--z-index-toolbar: 20;");
    expect(css).toContain("--z-index-modal: 40;");
    expect(css).not.toContain("--z-index-old");
    // Surrounding content outside the marker block is preserved.
    expect(css).toContain("--foo: 1;");
    expect(css).toContain("--bar: 2;");
  });

  it("is idempotent: a second run reports no change", () => {
    writeTokens(TOKENS_SRC);
    writeCss(STALE_CSS);
    run();

    const second = run();
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("already up to date");
    expect(second.stdout).toContain("no change");
  });

  it("--check passes when the committed block matches the tokens", () => {
    writeTokens(TOKENS_SRC);
    writeCss(UP_TO_DATE_CSS);

    const result = run(["--check"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK — z-index @theme block is up to date");
    // --check must not write.
    expect(readCss()).toBe(UP_TO_DATE_CSS);
  });

  it("--check fails when the block has drifted from the tokens", () => {
    writeTokens(TOKENS_SRC);
    writeCss(STALE_CSS);

    const result = run(["--check"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("codegen drift detected");
    // --check must not write.
    expect(readCss()).toBe(STALE_CSS);
  });

  it("fails when the BEGIN/END markers are missing from global.css", () => {
    writeTokens(TOKENS_SRC);
    writeCss(NO_MARKERS_CSS);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not find");
    expect(result.stderr).toContain("GENERATED:Z_INDEX_BEGIN");
  });

  it("fails when a tier object is missing name/value", () => {
    writeTokens(`export const Z_INDEX_TIERS = [
  { name: "base", value: 0 },
  { name: "broken" },
];
`);
    writeCss(UP_TO_DATE_CSS);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Malformed tier object");
  });

  it("fails when Z_INDEX_TIERS cannot be located", () => {
    writeTokens("export const SOMETHING_ELSE = [];\n");
    writeCss(UP_TO_DATE_CSS);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not locate");
  });

  it("fails when Z_INDEX_TIERS parses to an empty list", () => {
    writeTokens("export const Z_INDEX_TIERS = [];\n");
    writeCss(UP_TO_DATE_CSS);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("parsed to an empty list");
  });

  // Source-shape drift lock: the parser is a regex-based scan over
  // z-index-tokens.ts, not a real parser, so it must keep working across the
  // shape variations the real source file (and future edits to it) can take.
  describe("source-shape drift", () => {
    it("parses production-shape fields (purpose, kind) alongside name/value", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  { name: "content", value: 0, purpose: "default in-flow content", kind: "global" },
  { name: "local-1", value: 1, purpose: "child promotion inside an isolated parent", kind: "local" },
];
`);
      writeCss(STALE_CSS);

      const result = run();
      expect(result.status).toBe(0);

      const css = readCss();
      expect(css).toContain("--z-index-content: 0;");
      expect(css).toContain("--z-index-local-1: 1;");
    });

    it("parses tiers when value appears before name and extra fields are interleaved", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  { value: 20, kind: "global", name: "toolbar", purpose: "sticky top header" },
];
`);
      writeCss(STALE_CSS);

      const result = run();
      expect(result.status).toBe(0);

      const css = readCss();
      expect(css).toContain("--z-index-toolbar: 20;");
    });

    it("parses multi-line Prettier-style object formatting with trailing commas", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  {
    name: "modal-backdrop",
    value: 50,
    purpose: "mobile drawer backdrop, <dialog> ::backdrop",
    kind: "global",
  },
];
`);
      writeCss(STALE_CSS);

      const result = run();
      expect(result.status).toBe(0);

      const css = readCss();
      expect(css).toContain("--z-index-modal-backdrop: 50;");
    });

    it("parses negative tier values", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  { name: "behind", value: -1 },
  { name: "base", value: 0 },
];
`);
      writeCss(STALE_CSS);

      const result = run();
      expect(result.status).toBe(0);

      const css = readCss();
      expect(css).toContain("--z-index-behind: -1;");
      expect(css).toContain("--z-index-base: 0;");
    });

    it("ignores a brace-object literal inside a // line comment (ghost tier)", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  { name: "base", value: 0 },
  // { name: "ghost", value: 999 }
  { name: "toolbar", value: 20 },
];
`);
      writeCss(STALE_CSS);

      const result = run();
      expect(result.status).toBe(0);

      const css = readCss();
      expect(css).toContain("--z-index-base: 0;");
      expect(css).toContain("--z-index-toolbar: 20;");
      expect(css).not.toContain("--z-index-ghost");
    });

    it("ignores a brace-object literal inside a /* block comment */ (ghost tier)", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  { name: "base", value: 0 },
  /* reserved for later: { name: "ghost", value: 999 } */
  { name: "toolbar", value: 20 },
];
`);
      writeCss(STALE_CSS);

      const result = run();
      expect(result.status).toBe(0);

      const css = readCss();
      expect(css).toContain("--z-index-base: 0;");
      expect(css).toContain("--z-index-toolbar: 20;");
      expect(css).not.toContain("--z-index-ghost");
    });

    it("does not treat '//' inside a quoted purpose string as a comment (URL example)", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  { name: "base", value: 0, purpose: "https://example.com/docs", kind: "global" },
  { name: "toolbar", value: 20 },
];
`);
      writeCss(STALE_CSS);

      const result = run();
      expect(result.status).toBe(0);

      const css = readCss();
      expect(css).toContain("--z-index-base: 0;");
      expect(css).toContain("--z-index-toolbar: 20;");
    });

    it("fails on a malformed object even after the comment strip (existing malformed-object case still holds)", () => {
      writeTokens(`export const Z_INDEX_TIERS = [
  { name: "base", value: 0 },
  // just a note, no object here
  { name: "broken" },
];
`);
      writeCss(UP_TO_DATE_CSS);

      const result = run();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Malformed tier object");
    });
  });
});
