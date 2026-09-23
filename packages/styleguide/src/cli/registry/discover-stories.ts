// Pure filesystem discovery of `*.stories.tsx` files under a components
// root — ported from the host's former `scripts/gen-sg-registry.mjs`
// (#224's recursive-discovery rewrite). No config/host-path concerns live
// here; `gen-registry.ts` combines this per components root with the host's
// `zudo-sg.config.mjs`.
//
// Two co-existing directory layouts are discovered by the same recursive
// walk: the old one-level `<name>/<name>.stories.tsx` layout and the new
// category-nested `<category>/<name>/<name>.stories.tsx` layout (any depth).
// Neither is preferred — this just globs `**/*.stories.tsx` and derives each
// entry's preferred import name from its relative directory path. The
// combined registry allocates final names when those preferences collide;
// noncolliding old components keep their existing identifiers.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const STORIES_SUFFIX = ".stories.tsx";

export interface DiscoveredStory {
  /** Path stem relative to the components root, e.g. "badge/badge" or "layout/badge-icon/badge-icon". */
  relDirStem: string;
  /** Preferred import binding; the combined registry allocates a unique final name. */
  importName: string;
  /** Named-export declaration order of the story file, in source order. */
  exportOrder: string[];
}

/**
 * Recursively walk `dir` (relative to `absRoot`, POSIX-joined) collecting
 * every `*.stories.tsx` file at any depth. Directories whose name starts
 * with `.` or `_` are skipped at every level (keeps `__tests__` and any
 * future `_shared`-style helper dir out of discovery).
 */
function walkStoryFiles(absRoot: string, relDir: string): Array<{ relDir: string; file: string }> {
  const absDir = relDir ? resolve(absRoot, relDir) : absRoot;
  const dirEntries = readdirSync(absDir, { withFileTypes: true });

  const files = dirEntries
    .filter((d) => d.isFile() && d.name.endsWith(STORIES_SUFFIX))
    .map((d) => d.name)
    .sort();
  const subdirs = dirEntries
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  const results = files.map((file) => ({ relDir, file }));
  for (const sub of subdirs) {
    const nested = relDir ? `${relDir}/${sub}` : sub;
    results.push(...walkStoryFiles(absRoot, nested));
  }
  return results;
}

/** Kebab-case story stem (e.g. "site-header") → camelCase identifier. */
function camelCase(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Derive the preferred `import * as <name>` identifier from a story's containing
 * directory path (relative to the components root) — never from the file
 * stem alone. A 1-segment `relDir` (old flat layout) is byte-identical to
 * the previous `camelCase(stem)` derivation; a multi-segment `relDir`
 * (category-nested layout) folds the whole path into one identifier.
 */
export function dirPathToImportName(relDir: string): string {
  return camelCase(relDir.split("/").join("-"));
}

/**
 * Named-export declaration order of a `*.stories.tsx` body, in source order.
 * Only `export const <Name>` lines count — the runtime cannot recover this
 * order from an ES-module namespace (alphabetical per spec), so it's
 * captured here at discovery time.
 */
export function scanExportOrder(body: string): string[] {
  return [...body.matchAll(/^export const (\w+)/gm)].map((m) => m[1] as string);
}

/**
 * Glob `<absRoot>/**\/*.stories.tsx` off the filesystem (any depth) and
 * derive each entry's `relDirStem`, `importName`, and `exportOrder`.
 * Returns entries sorted alphabetically by `relDirStem`.
 */
export function discoverStories(absRoot: string): DiscoveredStory[] {
  const found = walkStoryFiles(absRoot, "");

  const entries: DiscoveredStory[] = found.map(({ relDir, file }) => {
    const stem = file.slice(0, -STORIES_SUFFIX.length);
    const body = readFileSync(resolve(absRoot, relDir, file), "utf8");
    return {
      relDirStem: relDir ? `${relDir}/${stem}` : stem,
      // A story directly under the root has no containing dir; fall back to its stem.
      importName: dirPathToImportName(relDir || stem),
      exportOrder: scanExportOrder(body),
    };
  });

  if (entries.length === 0) {
    throw new Error(`No *${STORIES_SUFFIX} files found under ${absRoot}`);
  }
  entries.sort((a, b) => a.relDirStem.localeCompare(b.relDirStem));
  return entries;
}
