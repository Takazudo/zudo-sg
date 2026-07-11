#!/usr/bin/env node
// scripts/gen-story-categories.mjs
//
// Codegen: rewrite the GENERATED:STORY_CATEGORIES marker block in every
// consumer that needs the StoryCategory set as a runtime value, from the
// single source of truth STORY_CATEGORIES in
// packages/ui/src/stories/types.ts.
//
// Targets:
//   - src/styleguide/data/registry.ts       (CATEGORY_ORDER array body)
//   - scripts/lib/component-scaffold.mjs     (VALID_CATEGORIES array body)
//
// Modeled directly on scripts/gen-z-index.mjs. Pure Node (fs only — NO npm
// deps, NO TypeScript import — types.ts is regex-parsed as source text so a
// plain Node script can read it). Idempotent: running twice produces no diff.
//
// Usage:
//   node scripts/gen-story-categories.mjs           # rewrite the blocks
//   node scripts/gen-story-categories.mjs --check   # verify committed blocks
//                                                    # are up to date
//                                                    # (exit 1 on drift, no write)
//
// MAINTENANCE: edit packages/ui/src/stories/types.ts (the source of truth),
// then run `pnpm gen:story-categories` and commit the regenerated files.
// Never hand-edit a block between the BEGIN/END markers.
//
// OUT OF SCOPE: adding a new category still needs a hand-added barrel
// section header ("// ── <Category> ──") in packages/ui/src/stories/index.ts
// — that file isn't a marker-block target here.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TYPES_PATH = resolve(ROOT, "packages/ui/src/stories/types.ts");

const BEGIN_MARKER = "GENERATED:STORY_CATEGORIES_BEGIN";
const END_MARKER = "GENERATED:STORY_CATEGORIES_END";

const TARGETS = [
  resolve(ROOT, "src/styleguide/data/registry.ts"),
  resolve(ROOT, "scripts/lib/component-scaffold.mjs"),
];

/**
 * Strip `//` line comments and `/* ... *\/` block comments from a JS/TS
 * source fragment, leaving quoted-string contents untouched. Without this, a
 * category name written inside a comment (or a category value containing
 * `//`, e.g. hypothetically a URL-like string) could be mis-parsed.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = src[i];
        out += c;
        i++;
        if (c === "\\" && i < n) {
          out += src[i];
          i++;
          continue;
        }
        if (c === quote) break;
      }
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i = Math.min(i + 2, n);
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Parse the STORY_CATEGORIES array out of types.ts's source text WITHOUT
 * importing it (this script is a dependency-free .mjs and cannot resolve
 * TypeScript). Throws on a malformed source so drift between the parser and
 * the file surfaces loudly.
 */
function parseCategories(src) {
  const arrayMatch = src.match(
    /export const STORY_CATEGORIES[^=]*=\s*\[([\s\S]*?)\]/,
  );
  if (!arrayMatch) {
    throw new Error(
      `Could not locate "export const STORY_CATEGORIES = [ ... ]" in ${TYPES_PATH}`,
    );
  }
  const body = stripComments(arrayMatch[1]);
  const categories = [];
  const stringRe = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = stringRe.exec(body)) !== null) {
    categories.push(m[1]);
  }
  if (categories.length === 0) {
    throw new Error(
      `STORY_CATEGORIES in ${TYPES_PATH} parsed to an empty list`,
    );
  }
  return categories;
}

/**
 * Build the generated marker block (markers included). Two leading spaces of
 * indentation match the surrounding array-literal style in both targets.
 */
function buildBlock(categories) {
  const lines = [];
  lines.push(
    `  // ${BEGIN_MARKER} — do not hand-edit; run pnpm gen:story-categories.`,
  );
  lines.push(
    `  // Source of truth: packages/ui/src/stories/types.ts (STORY_CATEGORIES).`,
  );
  for (const category of categories) {
    lines.push(`  "${category}",`);
  }
  lines.push(`  // ${END_MARKER}`);
  return lines.join("\n");
}

/**
 * Replace the existing BEGIN…END block in `src` with `block`. Throws if the
 * markers are missing (the block must be seeded once by hand — see
 * registry.ts / component-scaffold.mjs).
 */
function replaceBlock(src, block, targetPath) {
  const beginIdx = src.indexOf(BEGIN_MARKER);
  const endIdx = src.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(
      `Could not find ${BEGIN_MARKER} … ${END_MARKER} markers in ${targetPath}.\n` +
        `Seed the marker block once by hand, then re-run the generator.`,
    );
  }
  // Expand to the full comment line that opens the block ("  // GENERATED:...")
  // and to the end of the closing "// GENERATED:...END" line so the whole
  // region is replaced.
  const lineStart = src.lastIndexOf("\n", beginIdx) + 1;
  const afterEnd = src.indexOf("\n", endIdx);
  const lineEnd = afterEnd === -1 ? src.length : afterEnd;
  return src.slice(0, lineStart) + block + src.slice(lineEnd);
}

function main() {
  const check = process.argv.includes("--check");

  const typesSrc = readFileSync(TYPES_PATH, "utf8");
  const categories = parseCategories(typesSrc);
  const block = buildBlock(categories);

  const drifted = [];
  const results = TARGETS.map((targetPath) => {
    const current = readFileSync(targetPath, "utf8");
    const next = replaceBlock(current, block, targetPath);
    if (next !== current) drifted.push(targetPath);
    return { targetPath, current, next };
  });

  if (check) {
    if (drifted.length > 0) {
      console.error(
        "story-categories codegen drift detected: the following file(s) are out of date:",
      );
      for (const targetPath of drifted) {
        console.error(`  - ${targetPath}`);
      }
      console.error("Run `pnpm gen:story-categories` and commit the result.");
      return 1;
    }
    console.log(
      `OK — story categories are up to date in ${TARGETS.length} file(s) (${categories.length} categories).`,
    );
    return 0;
  }

  if (drifted.length === 0) {
    console.log(
      `Story category blocks already up to date in ${TARGETS.length} file(s) (${categories.length} categories); no change.`,
    );
    return 0;
  }

  for (const { targetPath, next } of results) {
    if (!drifted.includes(targetPath)) continue;
    writeFileSync(targetPath, next);
  }
  console.log(
    `Wrote story category blocks to ${drifted.length} file(s) (${categories.length} categories).`,
  );
  return 0;
}

process.exit(main());
