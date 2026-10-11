import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// Guard the shared breakpoint map used by the root host, demo-ui, and demo.
// Unknown names silently emit no CSS, so scan all three source trees for
// responsive prefixes, including prefixes composed with state variants.

// packages/demo-ui/src/shared/__tests__/breakpoint-tokens.test.ts -> repo root
const REPO_ROOT = resolve(__dirname, "../../../../../");
const windTokensUrl = pathToFileURL(resolve(REPO_ROOT, "packages/demo-ui/styles/wind-tokens.mjs")).href;
const { demoUiWindBreakpoints } = (await import(windTokensUrl)) as {
  demoUiWindBreakpoints: Record<string, { minWidthPx: number }>;
};
const SCAN_ROOTS = [
  resolve(REPO_ROOT, "packages/demo-ui/src"),
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

describe("breakpoint token coverage", () => {
  it("every responsive prefix used in production source has a matching --breakpoint-* token", () => {
    const definedBreakpoints = new Map(
      Object.entries(demoUiWindBreakpoints).map(([name, value]) => [name, value.minWidthPx]),
    );
    expect(Object.fromEntries(definedBreakpoints)).toEqual({ sm: 640, md: 768, lg: 1024, xl: 1280 });

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
