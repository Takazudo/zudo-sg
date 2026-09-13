import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for #278: Tailwind v4 Approach B (see tokens.css's file
// header) never imports the default theme, so an unknown breakpoint VARIANT
// (e.g. `md:` before `--breakpoint-md` existed) silently emits zero CSS
// instead of erroring — SplitLayout stayed permanently stacked with no build
// failure to catch it. This scans every production `.ts`/`.tsx` file across
// the three consumers that share packages/ui/styles/tokens.css (root host,
// @zudo-sg/ui itself, @zudo-sg/demo) for responsive-prefix usage and asserts
// each breakpoint name used is backed by a `--breakpoint-*` token, so a
// missing token fails a test instead of silently no-op-ing in the browser.

// packages/ui/src/shared/__tests__/breakpoint-tokens.test.ts -> repo root
const REPO_ROOT = resolve(__dirname, "../../../../../");
const TOKENS_CSS_PATH = resolve(REPO_ROOT, "packages/ui/styles/tokens.css");

const SCAN_ROOTS = [
  resolve(REPO_ROOT, "packages/ui/src"),
  resolve(REPO_ROOT, "src"),
  resolve(REPO_ROOT, "apps/demo"),
];

// Directories to never scan: test files/snapshots (own assertions may
// reference breakpoints that don't back real CSS — see split-layout.test.tsx),
// and non-source output.
const EXCLUDED_DIR_NAMES = new Set(["node_modules", "dist", "__tests__", "__snapshots__", ".zfb"]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (SCAN_EXTENSIONS.has(extname(entry.name))) files.push(fullPath);
  }
  return files;
}

// Strips comments so prose that merely mentions a breakpoint prefix (e.g. a
// JSDoc note like `` `sm:hidden` removes it from tab order ``) never
// masquerades as real usage.
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlockComments
    .split("\n")
    .map((line) => line.replace(/(?<!:)\/\/.*$/, ""))
    .join("\n");
}

// Matches a real Tailwind responsive-variant prefix (`sm:`, `max-md:`, ...):
// the colon must be immediately followed by the start of a class name or an
// arbitrary-value bracket, not whitespace. This deliberately excludes this
// codebase's very common `{ sm: "...", md: "...", lg: "..." }` size-variant
// lookup-map shape (an object key, always `md: "value"` with a space before
// the quoted value) from being mistaken for a breakpoint variant.
const BREAKPOINT_PREFIX_RE = /(?:^|[^a-zA-Z0-9_-])(?:max-)?(sm|md|lg|xl|2xl):(?=[a-zA-Z[])/g;

function findBreakpointUsages(source: string): string[] {
  return [...stripComments(source).matchAll(BREAKPOINT_PREFIX_RE)].map((match) => match[1]);
}

function readDefinedBreakpoints(): Set<string> {
  const css = readFileSync(TOKENS_CSS_PATH, "utf-8");
  return new Set([...css.matchAll(/--breakpoint-([a-zA-Z0-9]+):/g)].map((match) => match[1]));
}

describe("breakpoint token coverage", () => {
  it("every responsive prefix used in production source has a matching --breakpoint-* token", () => {
    const definedBreakpoints = readDefinedBreakpoints();
    // Sanity check the extraction itself found the known tokens, so a
    // silently-empty set can't make the assertion below vacuously pass.
    expect(definedBreakpoints).toEqual(new Set(["sm", "md", "lg", "xl"]));

    const missing: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        const source = readFileSync(file, "utf-8");
        for (const name of findBreakpointUsages(source)) {
          if (!definedBreakpoints.has(name)) missing.push(`${file} -> ${name}:`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
