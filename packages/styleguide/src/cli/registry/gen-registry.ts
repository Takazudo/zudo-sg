// Orchestration for `zudo-sg gen-registry [--check]` — combines every
// `componentsRoots[]` entry's discovered stories into ONE registry block
// written to `config.registryOut`, and (per components root, when the file
// already exists) refreshes its `stories/__tests__/story-modules.ts`
// contract-test fixture the same way the host's former
// `scripts/gen-sg-registry.mjs` did.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { ZudoSgComponentsRoot, ZudoSgConfig } from "../config.js";
import {
  buildRegistryBlock,
  buildStoryModulesBlock,
  replaceBlock,
  type RegistryEntry,
} from "./build-registry-source.js";
import { deriveMapKeyPrefix } from "../../registry/component-docs.js";
import { assertUniqueImportNames, discoverStories } from "./discover-stories.js";

const STORY_MODULES_RELATIVE_PATH = "stories/__tests__/story-modules.ts";

// Shared with the config module / detail route, which must resolve the same key prefix.
export { deriveMapKeyPrefix };

function buildEntriesForRoot(projectRoot: string, root: ZudoSgComponentsRoot): RegistryEntry[] {
  const absDir = resolve(projectRoot, root.dir);
  const keyPrefix = deriveMapKeyPrefix(root.dir);
  return discoverStories(absDir).map((entry) => ({
    ...entry,
    importSpecifier: `${root.importBase}/${entry.relDirStem}.stories.tsx`,
    mapKey: `./${keyPrefix}/${entry.relDirStem}.stories.tsx`,
  }));
}

export interface GenRegistryResult {
  /** Entries discovered across every components root, combined. */
  entryCount: number;
  /** Targets that would be (or were) written because their content changed. */
  changed: string[];
}

export interface GenRegistryOptions {
  /** Verify only — never write; throws when any target has drifted. */
  check?: boolean;
}

/**
 * Runs `gen-registry` against `config`, resolved relative to `projectRoot`.
 * Throws (without writing anything) on discovery errors, missing marker
 * blocks, or — in `--check` mode — drift.
 */
export function runGenRegistry(
  projectRoot: string,
  config: ZudoSgConfig,
  options: GenRegistryOptions = {},
): GenRegistryResult {
  const perRootEntries = config.componentsRoots.map((root) => ({
    root,
    entries: buildEntriesForRoot(projectRoot, root),
  }));
  const allEntries = perRootEntries.flatMap((r) => r.entries).sort((a, b) => a.mapKey.localeCompare(b.mapKey));
  // discoverStories only checks within one root; all roots share one import scope.
  assertUniqueImportNames(allEntries);

  const registryPath = resolve(projectRoot, config.registryOut);
  let registrySrc = "";
  let bootstrapRegistry = false;
  try {
    registrySrc = readFileSync(registryPath, "utf8");
    bootstrapRegistry = registrySrc.trim().length === 0;
  } catch (error) {
    if (!isErrorCode(error, "ENOENT")) throw error;
    bootstrapRegistry = true;
  }
  const registryBlock = buildRegistryBlock(allEntries);
  const nextRegistry = bootstrapRegistry
    ? registryBlock
    : replaceBlock(registrySrc, registryBlock, registryPath);

  const targets: Array<{ path: string; before: string; after: string }> = [
    { path: registryPath, before: registrySrc, after: nextRegistry },
  ];

  for (const { root, entries } of perRootEntries) {
    const absDir = resolve(projectRoot, root.dir);
    const storyModulesPath = resolve(absDir, STORY_MODULES_RELATIVE_PATH);
    if (!existsSync(storyModulesPath)) continue;
    const relativeImportPrefix = relative(dirname(storyModulesPath), absDir).split("\\").join("/");
    const before = readFileSync(storyModulesPath, "utf8");
    const after = replaceBlock(
      before,
      buildStoryModulesBlock(entries, relativeImportPrefix),
      storyModulesPath,
    );
    targets.push({ path: storyModulesPath, before, after });
  }

  const changed = targets.filter((t) => t.before !== t.after);

  if (options.check) {
    if (changed.length > 0) {
      throw new SgRegistryDriftError(changed.map((t) => t.path));
    }
    return { entryCount: allEntries.length, changed: [] };
  }

  for (const t of changed) {
    if (t.path === registryPath && bootstrapRegistry) {
      mkdirSync(dirname(t.path), { recursive: true });
    }
    writeFileSync(t.path, t.after);
  }
  return { entryCount: allEntries.length, changed: changed.map((t) => t.path) };
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export class SgRegistryDriftError extends Error {
  constructor(public readonly driftedPaths: string[]) {
    super(`sg-registry codegen drift detected:\n${driftedPaths.map((p) => `  - ${p}`).join("\n")}\nRun \`zudo-sg gen-registry\` and commit the result.`);
    this.name = "SgRegistryDriftError";
  }
}
