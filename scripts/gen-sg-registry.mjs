#!/usr/bin/env node
// scripts/gen-sg-registry.mjs
//
// Codegen: rewrite the GENERATED:SG_REGISTRY marker block in two files from a
// single source of truth — the `*.stories.tsx` files that actually exist under
// packages/ui/src/*/*.stories.tsx:
//   - src/styleguide/data/sg-registry.ts               (the catalog registry)
//   - packages/ui/src/stories/__tests__/story-modules.ts (the shared STORY_MODULES
//     registry imported by contract.test.ts and source-drift.test.ts)
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
// MAINTENANCE: add or remove a `packages/ui/src/<name>/<name>.stories.tsx`
// file, then run `pnpm gen:sg-registry` and commit the regenerated files.
// Never hand-edit either block between its BEGIN/END markers.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const UI_SRC_DIR = resolve(ROOT, "packages/ui/src");
const REGISTRY_PATH = resolve(ROOT, "src/styleguide/data/sg-registry.ts");
const STORY_MODULES_PATH = resolve(
  ROOT,
  "packages/ui/src/stories/__tests__/story-modules.ts",
);

const BEGIN_MARKER = "GENERATED:SG_REGISTRY_BEGIN";
const END_MARKER = "GENERATED:SG_REGISTRY_END";
const STORIES_SUFFIX = ".stories.tsx";

/**
 * Glob `packages/ui/src/<dir>/<name>.stories.tsx` off the filesystem (one
 * level deep, matching the co-location convention in STORIES.md §2). Returns
 * entries sorted alphabetically by `<dir>/<stem>` for deterministic output.
 */
function discoverStories() {
  const dirs = readdirSync(UI_SRC_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const entries = [];
  for (const dir of dirs) {
    const files = readdirSync(resolve(UI_SRC_DIR, dir)).filter((f) =>
      f.endsWith(STORIES_SUFFIX),
    );
    for (const file of files.sort()) {
      const stem = file.slice(0, -STORIES_SUFFIX.length);
      const body = readFileSync(resolve(UI_SRC_DIR, dir, file), "utf8");
      entries.push({
        relDirStem: `${dir}/${stem}`,
        importName: camelCase(stem),
        exportOrder: scanExportOrder(body),
      });
    }
  }
  if (entries.length === 0) {
    throw new Error(`No *${STORIES_SUFFIX} files found under ${UI_SRC_DIR}`);
  }
  return entries;
}

/** Kebab-case story stem (e.g. "site-header") → camelCase identifier. */
function camelCase(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
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
  lines.push(`import type { StoryModule } from "@zudo-sg/ui";`);
  lines.push(``);
  for (const e of entries) {
    lines.push(
      `import * as ${e.importName} from "@zudo-sg/ui/src/${e.relDirStem}.stories.tsx";`,
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
    lines.push(`import * as ${e.importName} from "../../${e.relDirStem}.stories";`);
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
