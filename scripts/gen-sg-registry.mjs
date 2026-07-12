#!/usr/bin/env node
// scripts/gen-sg-registry.mjs
//
// Codegen: rewrite the GENERATED:SG_REGISTRY marker block in two files from a
// single source of truth — the `*.stories.tsx` files that actually exist under
// packages/ui/src/**/*.stories.tsx (any depth — see discoverStories() below):
//   - src/styleguide/data/sg-registry.ts               (the catalog registry)
//   - packages/ui/src/stories/__tests__/story-modules.ts (the shared STORY_MODULES
//     registry imported by contract.test.ts and source-drift.test.ts)
//
// TWO co-existing directory layouts are discovered by the same recursive walk:
//   - OLD, one-level: packages/ui/src/<name>/<name>.stories.tsx
//   - NEW, category-nested: packages/ui/src/<category>/<name>/<name>.stories.tsx
// Neither layout is preferred by this script — it just globs `**/*.stories.tsx`
// and derives each entry's identity from its full relative directory path, so
// old components keep resolving to the exact same identifiers/keys they always
// had (a 1-segment relative dir round-trips unchanged) while new nested entries
// get distinct identifiers even when two categories scaffold a same-named
// component (e.g. `layout/badge/` vs `forms/badge/` — see dirPathToImportName).
//
// WHY CODEGEN (NOT import.meta.glob): zfb does not statically inline
// import.meta.glob — the literal call survives into the shared client islands
// bundle and throws in the browser (see sg-registry.ts's header comment).
// Story discovery must therefore be explicit static imports. Hand-listing
// those imports in three places (the two files above, plus packages/ui/STORIES.md)
// silently drops a component from the catalog when someone forgets one. This
// script makes the filesystem glob the source of truth and regenerates the
// explicit-import lists from it.
//
// Pure Node (fs + node:path only — NO npm deps), mirroring gen-z-index.mjs.
// Idempotent: running twice produces no diff.
//
// Usage:
//   node scripts/gen-sg-registry.mjs           # rewrite both generated blocks
//   node scripts/gen-sg-registry.mjs --check   # verify committed files are up
//                                               # to date (exit 1 on drift, no write)
//
// MAINTENANCE: add or remove a `packages/ui/src/<name>/<name>.stories.tsx` (or,
// under the category-nested layout, `packages/ui/src/<category>/<name>/<name>
// .stories.tsx`) file, then run `pnpm gen:sg-registry` and commit the
// regenerated files.
// Never hand-edit either block between its BEGIN/END markers.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPONENTS_ROOT, UI_PACKAGE_NAME } from "./lib/scaffold-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const UI_SRC_DIR = resolve(ROOT, COMPONENTS_ROOT);
const REGISTRY_PATH = resolve(ROOT, "src/styleguide/data/sg-registry.ts");
const STORY_MODULES_PATH = resolve(UI_SRC_DIR, "stories/__tests__/story-modules.ts");

// The `@zudo-sg/ui` package's `exports` map (packages/ui/package.json) wildcards
// its components-root basename ("./src/*": "./src/*") — so the package-scoped
// import specifier gen-sg-registry.mjs emits for sg-registry.ts is
// UI_PACKAGE_NAME + that basename, not the full COMPONENTS_ROOT path. A fork
// that relocates COMPONENTS_ROOT must keep its package.json exports subpath
// name in sync with this derivation.
const PACKAGE_STORIES_ROOT = `${UI_PACKAGE_NAME}/${basename(COMPONENTS_ROOT)}`;

// Relative-import prefix from story-modules.ts's directory back up to
// UI_SRC_DIR (normally "../..") — derived via path.relative rather than
// hardcoded so it stays correct if COMPONENTS_ROOT moves.
const RELATIVE_IMPORT_PREFIX = relative(dirname(STORY_MODULES_PATH), UI_SRC_DIR).split(
  "\\",
).join("/");

const BEGIN_MARKER = "GENERATED:SG_REGISTRY_BEGIN";
const END_MARKER = "GENERATED:SG_REGISTRY_END";
const STORIES_SUFFIX = ".stories.tsx";

/**
 * Recursively walk `dir` (relative to UI_SRC_DIR, POSIX-joined) collecting
 * every `*.stories.tsx` file at ANY depth — matching both the old one-level
 * layout (`<name>/<name>.stories.tsx`) and the new category-nested layout
 * (`<category>/<name>/<name>.stories.tsx`, or deeper). Directories whose name
 * starts with `.` or `_` are skipped at every level (keeps `__tests__` and any
 * future `_shared`-style helper dir out of discovery). Returns `{ relDir, file
 * }` pairs; both dirs and files are read in sorted order per directory for a
 * deterministic (if redundant — see the final sort in discoverStories) walk.
 */
function walkStoryFiles(relDir) {
  const absDir = relDir ? resolve(UI_SRC_DIR, relDir) : UI_SRC_DIR;
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
    results.push(...walkStoryFiles(nested));
  }
  return results;
}

/**
 * Glob `packages/ui/src/**\/*.stories.tsx` off the filesystem (any depth —
 * see walkStoryFiles) and derive each entry's `relDirStem` (registry-key
 * suffix), `importName` (JS identifier), and `exportOrder`. Returns entries
 * sorted alphabetically by `relDirStem` for deterministic output — this is
 * the exact order the old one-level-only implementation produced for every
 * entry that still lives at depth 1, so regenerating with existing
 * components only produces a byte-identical result.
 */
function discoverStories() {
  const found = walkStoryFiles("");

  const entries = found.map(({ relDir, file }) => {
    const stem = file.slice(0, -STORIES_SUFFIX.length);
    const body = readFileSync(resolve(UI_SRC_DIR, relDir, file), "utf8");
    return {
      relDirStem: `${relDir}/${stem}`,
      importName: dirPathToImportName(relDir),
      exportOrder: scanExportOrder(body),
    };
  });

  if (entries.length === 0) {
    throw new Error(`No *${STORIES_SUFFIX} files found under ${UI_SRC_DIR}`);
  }
  entries.sort((a, b) => a.relDirStem.localeCompare(b.relDirStem));
  assertUniqueImportNames(entries);
  return entries;
}

/** Kebab-case story stem (e.g. "site-header") → camelCase identifier. */
function camelCase(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * Derive the `import * as <name>` identifier from a story's CONTAINING
 * directory path (relative to UI_SRC_DIR) — never from the file stem alone.
 * For the old one-level layout `relDir` is one segment (e.g. "badge") and
 * this is byte-identical to the previous `camelCase(stem)` derivation, since
 * the convention is dir-name === file-stem. For the new category-nested
 * layout `relDir` is multiple segments (e.g. "layout/badge-icon"); joining
 * them with "-" before camelCasing folds the whole path into one identifier
 * ("layoutBadgeIcon"), so two categories scaffolding a same-named component
 * (e.g. "layout/badge" and "forms/badge") get distinct identifiers instead of
 * colliding on "badge" — see assertUniqueImportNames for the defensive check
 * that backs this up.
 */
function dirPathToImportName(relDir) {
  return camelCase(relDir.split("/").join("-"));
}

/**
 * Throws if two entries derive the same `importName` — `import * as X` twice
 * under the same identifier is a duplicate-declaration syntax error, but this
 * check surfaces it as a clear codegen-time message (naming the two
 * colliding directories) instead of an opaque downstream failure. In
 * practice this can only happen if two distinct directory paths coincide
 * once hyphens and slashes are folded together (e.g. "foo-bar/baz" and
 * "foo/bar-baz" both fold to "foo-bar-baz") — genuinely duplicate component
 * names across categories (e.g. "layout/badge" vs "forms/badge") do NOT
 * collide, by design (see dirPathToImportName).
 */
function assertUniqueImportNames(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const prior = seen.get(entry.importName);
    if (prior !== undefined) {
      throw new Error(
        `gen-sg-registry: "${prior}" and "${entry.relDirStem}" both derive the import ` +
          `identifier "${entry.importName}" — rename one of the component directories ` +
          `so their derived identifiers don't collide.`,
      );
    }
    seen.set(entry.importName, entry.relDirStem);
  }
}

/**
 * Named-export declaration order of a `*.stories.tsx` body, in source order.
 * Only `export const <Name>` lines count — this is exactly the set the runtime
 * `import * as` namespace surfaces as named exports (minus `export default meta`,
 * which is not `const`). `export { … }` / `export type` / `export function`
 * lines are intentionally ignored (all 10 current story files use the uniform
 * `export const <Name>: Story… = {` pattern; ignoring the others is safe and
 * future-resilient). The runtime cannot recover this order — an ES-module
 * namespace enumerates its keys alphabetically per spec — so it must be captured
 * here at build time and threaded through the registry (see #128 / #174).
 */
function scanExportOrder(body) {
  return [...body.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
}

/**
 * Build the generated block for sg-registry.ts: the `StoryModule` import, one
 * `import * as <name>` per story, and the `storyModules` map. Byte-compatible
 * with the shape registry.ts's `Object.entries(storyModules)` consumer expects.
 */
function buildRegistryBlock(entries) {
  const lines = [];
  lines.push(`// ${BEGIN_MARKER} — do not hand-edit; run \`pnpm gen:sg-registry\`.`);
  lines.push(`import type { StoryModule } from "${UI_PACKAGE_NAME}";`);
  lines.push(``);
  for (const e of entries) {
    lines.push(
      `import * as ${e.importName} from "${PACKAGE_STORIES_ROOT}/${e.relDirStem}.stories.tsx";`,
    );
  }
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * Path → story module map. Keys are glob-relative (e.g.`);
  lines.push(` * \`./ui/src/button/button.stories.tsx\`). Each module is`);
  lines.push(` * \`{ default: meta, ...named Story exports }\`.`);
  lines.push(` */`);
  lines.push(`export const storyModules: Record<string, StoryModule> = {`);
  for (const e of entries) {
    lines.push(
      `  "./ui/src/${e.relDirStem}.stories.tsx": ${e.importName} as unknown as StoryModule,`,
    );
  }
  lines.push(`};`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * Per-story named-export declaration order (SOURCE order), keyed by the`);
  lines.push(` * same path as \`storyModules\`. registry.ts sorts each story's variants`);
  lines.push(` * by this so tabs render in authored order (and the default tab is the`);
  lines.push(` * first-authored story) instead of the alphabetical key-enumeration order`);
  lines.push(` * of the \`import * as\` namespace. Captured at codegen time because the`);
  lines.push(` * runtime namespace cannot recover source order (#128 / #174). Superset:`);
  lines.push(` * lists every \`export const\`, so registry.ts uses it only to SORT the`);
  lines.push(` * \`isStory()\`-filtered variants, never to gate membership.`);
  lines.push(` */`);
  lines.push(`export const storyExportOrder: Record<string, string[]> = {`);
  for (const e of entries) {
    const arr = e.exportOrder.map((n) => JSON.stringify(n)).join(", ");
    lines.push(`  "./ui/src/${e.relDirStem}.stories.tsx": [${arr}],`);
  }
  lines.push(`};`);
  lines.push(`// ${END_MARKER}`);
  return lines.join("\n");
}

/**
 * Build the generated block for story-modules.ts: one `import * as <name>` per
 * story (relative, extensionless) and the exported `STORY_MODULES` map shared
 * by contract.test.ts and source-drift.test.ts.
 */
function buildStoryModulesBlock(entries) {
  const lines = [];
  lines.push(`// ${BEGIN_MARKER} — do not hand-edit; run \`pnpm gen:sg-registry\`.`);
  for (const e of entries) {
    lines.push(
      `import * as ${e.importName} from "${RELATIVE_IMPORT_PREFIX}/${e.relDirStem}.stories";`,
    );
  }
  lines.push(``);
  lines.push(`export const STORY_MODULES: Record<string, StoryModule> = {`);
  for (const e of entries) {
    lines.push(
      `  "${e.relDirStem}.stories.tsx": ${e.importName} as unknown as StoryModule,`,
    );
  }
  lines.push(`};`);
  lines.push(`// ${END_MARKER}`);
  return lines.join("\n");
}

/**
 * Replace the existing BEGIN…END block in `content` with `block`. Throws if
 * the markers are missing (each block must be seeded once by hand — see
 * sg-registry.ts / contract.test.ts).
 */
function replaceBlock(content, block, filePath) {
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(
      `Could not find ${BEGIN_MARKER} … ${END_MARKER} markers in ${filePath}.\n` +
        `Seed the marker block once by hand, then re-run the generator.`,
    );
  }
  const lineStart = content.lastIndexOf("\n", beginIdx) + 1;
  const afterEnd = content.indexOf("\n", endIdx);
  const lineEnd = afterEnd === -1 ? content.length : afterEnd;
  return content.slice(0, lineStart) + block + content.slice(lineEnd);
}

function main() {
  const check = process.argv.includes("--check");
  const entries = discoverStories();

  const registrySrc = readFileSync(REGISTRY_PATH, "utf8");
  const nextRegistry = replaceBlock(
    registrySrc,
    buildRegistryBlock(entries),
    REGISTRY_PATH,
  );

  const storyModulesSrc = readFileSync(STORY_MODULES_PATH, "utf8");
  const nextStoryModules = replaceBlock(
    storyModulesSrc,
    buildStoryModulesBlock(entries),
    STORY_MODULES_PATH,
  );

  const targets = [
    { path: REGISTRY_PATH, before: registrySrc, after: nextRegistry },
    { path: STORY_MODULES_PATH, before: storyModulesSrc, after: nextStoryModules },
  ];

  if (check) {
    const drifted = targets.filter((t) => t.before !== t.after);
    if (drifted.length > 0) {
      console.error("sg-registry codegen drift detected:");
      for (const t of drifted) console.error(`  - ${relative(ROOT, t.path)}`);
      console.error("Run `pnpm gen:sg-registry` and commit the result.");
      return 1;
    }
    console.log(`OK — sg-registry is up to date (${entries.length} stories).`);
    return 0;
  }

  const written = targets.filter((t) => t.before !== t.after);
  for (const t of written) {
    writeFileSync(t.path, t.after);
    console.log(`Wrote generated block to ${relative(ROOT, t.path)}.`);
  }
  if (written.length === 0) {
    console.log(
      `sg-registry already up to date (${entries.length} stories); no change.`,
    );
  }
  return 0;
}

process.exit(main());
