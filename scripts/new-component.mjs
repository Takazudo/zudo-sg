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
import { BARREL_INDEX, COMPONENTS_ROOT } from "./lib/scaffold-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const UI_SRC_DIR = resolve(ROOT, COMPONENTS_ROOT);
const INDEX_PATH = BARREL_INDEX ? resolve(ROOT, BARREL_INDEX) : null;
const GEN_REGISTRY_SCRIPT = resolve(__dirname, "gen-sg-registry.mjs");

export function parseArgs(argv) {
  const positional = [];
  let category;
  let skipBarrel = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--category") {
      category = argv[++i];
    } else if (arg.startsWith("--category=")) {
      category = arg.slice("--category=".length);
    } else if (arg === "--skip-barrel") {
      skipBarrel = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }
  return { name: positional[0], category, skipBarrel };
}

function printUsage() {
  console.error(
    `Usage: pnpm new:component <name> --category <Category> [--skip-barrel]\n` +
      `  <Category> must be one of: ${VALID_CATEGORIES.join(", ")}\n` +
      `  --skip-barrel skips inserting the export into ${BARREL_INDEX ?? "the barrel file"}.`,
  );
}

function main() {
  const { name, category, skipBarrel } = parseArgs(process.argv.slice(2));

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

  const shouldInsertBarrel = INDEX_PATH !== null && !skipBarrel;
  if (shouldInsertBarrel) {
    const indexSrc = readFileSync(INDEX_PATH, "utf8");
    writeFileSync(
      INDEX_PATH,
      insertBarrelExport(indexSrc, { pascalName, kebabName: name, category }),
    );
  }

  console.log(`Scaffolded ${pascalName} at ${COMPONENTS_ROOT}/${name}/`);
  if (shouldInsertBarrel) {
    console.log(`Added the barrel export to ${BARREL_INDEX}.`);
  } else if (INDEX_PATH === null) {
    console.log("No BARREL_INDEX configured — skipped the barrel-export step.");
  } else {
    console.log("Skipped the barrel-export step (--skip-barrel).");
  }

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

  const steps = [
    `Fill in the TODOs in ${COMPONENTS_ROOT}/${name}/${name}.tsx and ${name}.stories.tsx.`,
  ];
  if (!shouldInsertBarrel && INDEX_PATH !== null) {
    steps.push(`Add the barrel export to ${BARREL_INDEX} by hand (skipped via --skip-barrel).`);
  }
  steps.push(`Run \`pnpm lint:tokens\`, \`pnpm check\`, and \`pnpm test:unit\`.`);
  steps.push(`\`pnpm build\`, then visit /components/${name} to confirm it renders.`);

  console.log(
    `\nNext steps:\n${steps.map((step, i) => `  ${i + 1}. ${step}`).join("\n")}`,
  );
  return 0;
}

// Guard so `import { parseArgs } from "./new-component.mjs"` (see
// scripts/__tests__/component-scaffold.test.ts) doesn't also run the CLI —
// only run main() when this file is the process entry point.
const isMainModule = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isMainModule) {
  process.exit(main());
}
