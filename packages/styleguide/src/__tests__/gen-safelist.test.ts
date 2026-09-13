// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import the generator functions directly so the test exercises the same
// logic the tsup onSuccess hook runs, without needing a built dist or
// spawning Node as a child process. The .mjs is plain ESM with no Node
// built-ins called at import time (only inside main()), so dynamic import
// works fine from vitest's ESM environment.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Steps outside src/ into scripts/ — vitest resolves this at test time; it is
// NOT compiled by tsup.
const { extractTokens, emitSafelist, findJsFiles } = await import(
  resolve(__dirname, "../../scripts/gen-safelist.mjs")
);

function tokens(src: string): Set<string> {
  return extractTokens(src, new Set());
}

// ── findJsFiles ──────────────────────────────────────────────────────────

describe("findJsFiles", () => {
  it("recursively collects every .js file, sorted", () => {
    const dist = mkdtempSync(resolve(tmpdir(), "zudo-sg-safelist-"));
    try {
      mkdirSync(resolve(dist, "chrome"));
      mkdirSync(resolve(dist, "catalog"));
      writeFileSync(resolve(dist, "chrome/index.js"), '"sentinel-chrome"');
      writeFileSync(resolve(dist, "catalog/index.js"), '"sentinel-catalog"');
      writeFileSync(resolve(dist, "chrome/panel.d.ts"), "export {};");

      const files: string[] = findJsFiles(dist);
      expect(files.map((f) => f.slice(dist.length + 1)).sort()).toEqual([
        "catalog/index.js",
        "chrome/index.js",
      ]);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});

// ── extractTokens ──────────────────────────────────────────────────────────

describe("extractTokens", () => {
  it("extracts tokens from a double-quoted string", () => {
    const result = tokens(`const c = "hidden lg:block fixed";`);
    expect(result.has("hidden")).toBe(true);
    expect(result.has("lg:block")).toBe(true);
    expect(result.has("fixed")).toBe(true);
  });

  it("extracts tokens from a single-quoted string", () => {
    const result = tokens(`const c = 'sticky top-0 z-50';`);
    expect(result.has("sticky")).toBe(true);
    expect(result.has("top-0")).toBe(true);
    expect(result.has("z-50")).toBe(true);
  });

  it("extracts tokens from a ternary expression string", () => {
    const result = tokens(
      `const cls = isActive ? "bg-fg text-bg" : "text-muted hover:underline";`,
    );
    expect(result.has("bg-fg")).toBe(true);
    expect(result.has("text-bg")).toBe(true);
    expect(result.has("text-muted")).toBe(true);
    expect(result.has("hover:underline")).toBe(true);
  });

  it("extracts tokens from template-literal quasis (static parts)", () => {
    const result = tokens("`hidden lg:block fixed top-[3.5rem] ${x}`");
    expect(result.has("hidden")).toBe(true);
    expect(result.has("lg:block")).toBe(true);
    expect(result.has("fixed")).toBe(true);
    expect(result.has("top-[3.5rem]")).toBe(true);
  });

  it("extracts tokens from quoted strings nested inside template interpolations", () => {
    const result = tokens('`base ${active ? "min-w-[10rem]" : "xl:hidden"}`');
    expect(result.has("base")).toBe(true);
    expect(result.has("min-w-[10rem]")).toBe(true);
    expect(result.has("xl:hidden")).toBe(true);
  });

  it("handles bracket utilities with complex values", () => {
    const result = tokens(
      `"top-[3.5rem] w-[var(--zd-sidebar-w)] h-[calc(100vh-3.5rem)]"`,
    );
    expect(result.has("top-[3.5rem]")).toBe(true);
    expect(result.has("w-[var(--zd-sidebar-w)]")).toBe(true);
    expect(result.has("h-[calc(100vh-3.5rem)]")).toBe(true);
  });

  it("skips line and block comments", () => {
    const result = tokens(
      `// "commented-out-class"\n/* "block-commented" */ "real-class"`,
    );
    expect(result.has("commented-out-class")).toBe(false);
    expect(result.has("block-commented")).toBe(false);
    expect(result.has("real-class")).toBe(true);
  });

  // Class-shape filter (mirrors the zudo-doc #1993 fix): the dist JS holds far
  // more than Tailwind class strings — JS fragments, HTML entities, hex
  // colors — and Tailwind v4 ABORTS the build on a malformed @source
  // inline() candidate. The filter must keep every real class candidate
  // (including the styleguide's own `sg-*` / `hsp-*` / `vsp-*` utilities)
  // and drop everything else.
  function keepsToken(tok: string): boolean {
    return extractTokens(`"${tok}"`, new Set()).has(tok);
  }

  const MUST_KEEP = [
    "sticky",
    "top-0",
    "z-50",
    "border-muted",
    "bg-surface",
    "px-hsp-lg",
    "py-vsp-sm",
    "bg-accent",
    "text-on-accent",
    "lg:block",
    "xl:hidden",
    "top-[3.5rem]",
    "w-[var(--sg-code-panel-w)]",
    "bg-[#fff]",
    "focus-visible:outline-2",
  ];

  const MUST_DROP = [
    "catch(e){",
    "&gt;",
    "&lt;",
    "#000000",
    "#ffffff",
    "$1",
    "&&",
    "!important;",
    "()",
    "Activate",
    "ColorSchemeProvider",
    "B7B7B7",
  ];

  it.each(MUST_KEEP)("class-shape filter keeps real class %s", (tok) => {
    expect(keepsToken(tok)).toBe(true);
  });

  it.each(MUST_DROP)("class-shape filter drops junk %s", (tok) => {
    expect(keepsToken(tok)).toBe(false);
  });

  it("drops a JS code fragment that would abort the Tailwind build", () => {
    const result = tokens(`try { foo(); } catch(e){ bar(); }`);
    for (const t of result) {
      const masked = t.replace(/\[[^\]]*\]/g, "");
      expect(masked).not.toMatch(/[(){}]/);
    }
  });

  it("deduplicates repeated tokens across multiple strings", () => {
    const result = tokens(`"flex items-center" + "flex gap-4"`);
    expect([...result].filter((t) => t === "flex").length).toBe(1);
  });
});

// ── emitSafelist ───────────────────────────────────────────────────────────

describe("emitSafelist", () => {
  it("emits a single, alphabetically sorted @source inline() directive", () => {
    const css = emitSafelist(new Set(["z-50", "flex", "block"]));
    const lines = css.split("\n").filter((l: string) => l.includes("@source"));
    expect(lines.length).toBe(1);
    expect(css).toContain('"block flex z-50"');
  });

  it("the emitted string is double-quote safe", () => {
    const css = emitSafelist(new Set(["flex", "block"]));
    const m = css.match(/@source inline\("(.*)"\)/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain('"');
  });

  it("includes a generated-by comment line", () => {
    const css = emitSafelist(new Set(["flex"]));
    expect(css).toMatch(/generated by gen-safelist/);
  });
});

// ── Real dist smoke test ────────────────────────────────────────────────────

describe("gen-safelist against the built package", () => {
  it("dist/safelist.css (once built) contains real catalog/chrome classes", () => {
    const distSafelist = resolve(__dirname, "../../dist/safelist.css");
    let content: string;
    try {
      content = readFileSync(distSafelist, "utf8");
    } catch {
      // dist/ is a build artifact; skip gracefully on a source-only checkout
      // (the package `check`/`build` scripts run gen-safelist directly and
      // enforce this file's presence via check-package-safelist.mjs).
      return;
    }
    expect(content).toMatch(/@source inline\("[^"]*"\);/);
    // A couple of classes real package sources are known to emit.
    expect(content).toContain("flex");
  });
});
