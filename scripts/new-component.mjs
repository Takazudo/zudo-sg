#!/usr/bin/env node
// scripts/new-component.mjs
//
// Scaffolds the full "add a component" checklist for @zudo-sg/ui in one
// command: a typed-props component skeleton, a stories file in the typed
// `Story<Props>` shape (STORIES.md §3), a starter test file, the barrel
// export in packages/ui/src/index.ts, and a `gen:sg-registry` run — so the
// new component shows up in the S6 catalog with zero further manual edits
// beyond filling in the generated TODOs.
//
// Usage:
//   pnpm new:component <name> --category <Category>
//   node scripts/new-component.mjs <name> --category <Category>
//
// <name>     must be kebab-case and not already exist under packages/ui/src/.
// <Category> must be one of the StoryCategory union members (see
//            scripts/lib/component-scaffold.mjs → VALID_CATEGORIES).
//
// See packages/ui/STORIES.md → "Scaffolding a new component" for what gets
// generated and what to do next. Pure helpers (validation, templates, the
// barrel-insertion algorithm) live in scripts/lib/component-scaffold.mjs and
// are unit-tested in scripts/__tests__/component-scaffold.test.ts — this file
// is just the fs/process orchestration.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VALID_CATEGORIES,
  assertUnusedName,
  assertValidCategory,
  assertValidName,
  componentTemplate,
  insertBarrelExport,
  storiesTemplate,
  testTemplate,
  toPascalCase,
} from "./lib/component-scaffold.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const UI_SRC_DIR = resolve(ROOT, "packages/ui/src");
const INDEX_PATH = resolve(UI_SRC_DIR, "index.ts");
const GEN_REGISTRY_SCRIPT = resolve(__dirname, "gen-sg-registry.mjs");

function parseArgs(argv) {
  const positional = [];
  let category;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--category") {
      category = argv[++i];
    } else if (arg.startsWith("--category=")) {
      category = arg.slice("--category=".length);
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }
  return { name: positional[0], category };
}

function printUsage() {
  console.error(
    `Usage: pnpm new:component <name> --category <Category>\n` +
      `  <Category> must be one of: ${VALID_CATEGORIES.join(", ")}`,
  );
}

function main() {
  const { name, category } = parseArgs(process.argv.slice(2));

  if (!name || !category) {
    printUsage();
    return 1;
  }

  try {
    assertValidName(name);
    assertValidCategory(category);
    const existingNames = readdirSync(UI_SRC_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assertUnusedName(name, existingNames);
  } catch (err) {
    console.error(`new-component: ${err.message}`);
    return 1;
  }

  const pascalName = toPascalCase(name);
  const componentDir = resolve(UI_SRC_DIR, name);
  const testsDir = resolve(componentDir, "__tests__");
  mkdirSync(testsDir, { recursive: true });

  writeFileSync(
    resolve(componentDir, `${name}.tsx`),
    componentTemplate({ pascalName, kebabName: name }),
  );
  writeFileSync(
    resolve(componentDir, `${name}.stories.tsx`),
    storiesTemplate({ pascalName, kebabName: name, category }),
  );
  writeFileSync(
    resolve(testsDir, `${name}.test.tsx`),
    testTemplate({ pascalName, kebabName: name }),
  );

  const indexSrc = readFileSync(INDEX_PATH, "utf8");
  writeFileSync(
    INDEX_PATH,
    insertBarrelExport(indexSrc, { pascalName, kebabName: name, category }),
  );

  console.log(`Scaffolded ${pascalName} at packages/ui/src/${name}/`);
  console.log("Added the barrel export to packages/ui/src/index.ts.");

  // Shell out to `node <gen-sg-registry.mjs>` directly rather than
  // `pnpm gen:sg-registry` so this doesn't depend on pnpm being resolvable
  // from a child process's PATH — the generator itself has no npm deps.
  const registryResult = spawnSync(process.execPath, [GEN_REGISTRY_SCRIPT], {
    stdio: "inherit",
    cwd: ROOT,
  });
  if (registryResult.status !== 0) {
    console.error(
      "new-component: files were scaffolded, but gen-sg-registry failed — " +
        "run `pnpm gen:sg-registry` by hand.",
    );
    return 1;
  }

  console.log(
    `\nNext steps:\n` +
      `  1. Fill in the TODOs in packages/ui/src/${name}/${name}.tsx and ${name}.stories.tsx.\n` +
      `  2. Run \`pnpm lint:tokens\`, \`pnpm check\`, and \`pnpm test:unit\`.\n` +
      `  3. \`pnpm build\`, then visit /components/${name} to confirm it renders.`,
  );
  return 0;
}

process.exit(main());
