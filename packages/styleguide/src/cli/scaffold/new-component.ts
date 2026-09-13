// Orchestration for `zudo-sg new-component <name> --category <c> [--nested]
// [--skip-barrel]` — the fs/process side of the pure helpers in
// component-scaffold.ts. Ported from the host's former
// `scripts/new-component.mjs`; resolves every path against the host's
// `zudo-sg.config.mjs` (via `resolveHostModule`/`config.componentsRoots[0]`)
// instead of the old hardcoded `scaffold-config.mjs` constants.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ZudoSgConfig } from "../config.js";
import { runGenRegistry } from "../registry/gen-registry.js";
import {
  assertUnusedName,
  assertValidCategory,
  assertValidName,
  categorySlug,
  componentTemplate,
  insertBarrelExport,
  storiesTemplate,
  testTemplate,
  toPascalCase,
} from "./component-scaffold.js";

export interface ParsedNewComponentArgs {
  name: string | undefined;
  category: string | undefined;
  skipBarrel: boolean;
  nested: boolean;
}

export function parseArgs(argv: string[]): ParsedNewComponentArgs {
  const positional: string[] = [];
  let category: string | undefined;
  let skipBarrel = false;
  let nested = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--category") {
      category = argv[++i];
    } else if (arg.startsWith("--category=")) {
      category = arg.slice("--category=".length);
    } else if (arg === "--skip-barrel") {
      skipBarrel = true;
    } else if (arg === "--nested") {
      nested = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }
  return { name: positional[0], category, skipBarrel, nested };
}

export function printNewComponentUsage(validCategories: string[], barrelIndex: string | null): void {
  console.error(
    `Usage: pnpm new:component <name> --category <Category> [--skip-barrel] [--nested]\n` +
      `  <Category> is a free-form string. Declared categories: ${validCategories.join(", ")}\n` +
      `  --skip-barrel skips inserting the export into ${barrelIndex ?? "the barrel file"}.\n` +
      `  --nested scaffolds <componentsRoot>/<category-slug>/<name>/ — still inserts into the\n` +
      `    barrel by default (import path adjusted for the nesting); --skip-barrel opts out.`,
  );
}

/**
 * Runs `new-component` against `config`, resolved relative to
 * `projectRoot`. Scaffolds into `config.componentsRoots[0]` — the first
 * components root is the scaffold target when a host declares more than
 * one. Returns 0 on success, 1 on a handled failure (already reported via
 * console.error).
 */
export function runNewComponent(
  projectRoot: string,
  config: ZudoSgConfig,
  { name, category, skipBarrel, nested }: ParsedNewComponentArgs,
): number {
  if (!name || !category) {
    printNewComponentUsage(config.categoryOrder, config.barrelIndex);
    return 1;
  }

  const componentsRoot = config.componentsRoots[0];
  if (!componentsRoot) {
    console.error("new-component: config.componentsRoots is empty — nowhere to scaffold into.");
    return 1;
  }

  const uiSrcDir = resolve(projectRoot, componentsRoot.dir);
  const indexPath = config.barrelIndex ? resolve(projectRoot, config.barrelIndex) : null;

  const scanRoot = nested ? resolve(uiSrcDir, categorySlug(category)) : uiSrcDir;
  const componentDir = nested ? resolve(uiSrcDir, categorySlug(category), name) : resolve(uiSrcDir, name);
  const relComponentDir = nested
    ? `${componentsRoot.dir}/${categorySlug(category)}/${name}`
    : `${componentsRoot.dir}/${name}`;

  const pascalName = toPascalCase(name);
  const shouldInsertBarrel = indexPath !== null && !skipBarrel;
  let newIndexSrc: string | undefined;

  try {
    assertValidName(name);
    assertValidCategory(category, config.categoryOrder);
    const existingNames = existsSync(scanRoot)
      ? readdirSync(scanRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      : [];
    assertUnusedName(name, existingNames, componentsRoot.dir);

    // Compute (and validate) the barrel insertion BEFORE writing any
    // component files — insertBarrelExport throws on a same-name collision,
    // so fail early rather than leaving a half-scaffolded directory on disk.
    if (shouldInsertBarrel && indexPath) {
      const indexSrc = readFileSync(indexPath, "utf8");
      newIndexSrc = insertBarrelExport(indexSrc, { pascalName, kebabName: name, category, nested });
    }
  } catch (err) {
    console.error(`new-component: ${(err as Error).message}`);
    return 1;
  }

  const testsDir = resolve(componentDir, "__tests__");
  mkdirSync(testsDir, { recursive: true });

  writeFileSync(resolve(componentDir, `${name}.tsx`), componentTemplate({ pascalName, kebabName: name, nested }));
  writeFileSync(
    resolve(componentDir, `${name}.stories.tsx`),
    storiesTemplate({ pascalName, kebabName: name, category, uiPackageName: config.uiPackageName, nested }),
  );
  writeFileSync(resolve(testsDir, `${name}.test.tsx`), testTemplate({ pascalName, kebabName: name }));

  if (shouldInsertBarrel && indexPath && newIndexSrc) {
    writeFileSync(indexPath, newIndexSrc);
  }

  console.log(`Scaffolded ${pascalName} at ${relComponentDir}/`);
  if (shouldInsertBarrel) {
    console.log(`Added the barrel export to ${config.barrelIndex}.`);
  } else if (indexPath === null) {
    console.log("No barrelIndex configured — skipped the barrel-export step.");
  } else {
    console.log("Skipped the barrel-export step (--skip-barrel).");
  }

  try {
    runGenRegistry(projectRoot, config);
  } catch (err) {
    console.error(
      `new-component: files were scaffolded, but gen-registry failed — run \`pnpm gen:sg-registry\` by hand.\n${(err as Error).message}`,
    );
    return 1;
  }

  const steps = [`Fill in the TODOs in ${relComponentDir}/${name}.tsx and ${name}.stories.tsx.`];
  if (!shouldInsertBarrel && indexPath !== null) {
    steps.push(`Add the barrel export to ${config.barrelIndex} by hand (skipped via --skip-barrel).`);
  }
  steps.push(`Run \`pnpm lint:tokens\`, \`pnpm check\`, and \`pnpm test:unit\`.`);
  steps.push(`\`pnpm build\`, then visit /components/${name} to confirm it renders.`);

  console.log(`\nNext steps:\n${steps.map((step, i) => `  ${i + 1}. ${step}`).join("\n")}`);
  return 0;
}
