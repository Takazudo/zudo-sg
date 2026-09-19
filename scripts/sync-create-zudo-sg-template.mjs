#!/usr/bin/env node
// Keep packages/create-zudo-sg/templates/default in lockstep with the
// engine-host fixture. The fixture is the executable source of truth: this
// script only applies the few changes needed when it becomes a starter that a
// user can install and run.
//
// Usage:
//   pnpm sync:create-template
//   pnpm check:create-template
//
// `--check` never writes. It compares the generated tree with the committed
// template and reports every missing, extra, or changed path.

import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(SCRIPT_DIR, "..");
export const SOURCE_DIR = join(ROOT_DIR, "fixtures", "engine-host");
export const TARGET_DIR = join(
  ROOT_DIR,
  "packages",
  "create-zudo-sg",
  "templates",
  "default",
);
export const STYLEGUIDE_PACKAGE_PATH = join(
  ROOT_DIR,
  "packages",
  "styleguide",
  "package.json",
);

const SKIPPED_NAMES = new Set([
  "node_modules",
  "dist",
  ".zfb-build",
  ".tarball",
  "pnpm-lock.yaml",
]);

/** @typedef {Map<string, Buffer>} TemplateTree */

/**
 * Read a fixture tree and apply the starter-only transforms in memory.
 *
 * @param {{sourceDir?: string, styleguidePackagePath?: string}} [options]
 * @returns {Promise<TemplateTree>}
 */
export async function buildTemplate({
  sourceDir = SOURCE_DIR,
  styleguidePackagePath = STYLEGUIDE_PACKAGE_PATH,
} = {}) {
  const styleguidePackage = JSON.parse(
    await readFile(styleguidePackagePath, "utf8"),
  );
  if (
    typeof styleguidePackage.version !== "string" ||
    styleguidePackage.version.length === 0
  ) {
    throw new Error(
      `Expected a non-empty version in ${relative(ROOT_DIR, styleguidePackagePath)}`,
    );
  }

  /** @type {TemplateTree} */
  const files = new Map();
  await collectFiles(files, sourceDir, "", styleguidePackage.version);
  return new Map([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * @param {TemplateTree} files
 * @param {string} directory
 * @param {string} relativeDirectory
 * @param {string} styleguideVersion
 */
async function collectFiles(
  files,
  directory,
  relativeDirectory,
  styleguideVersion,
) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIPPED_NAMES.has(entry.name)) continue;

    const sourcePath = join(directory, entry.name);
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      await collectFiles(files, sourcePath, relativePath, styleguideVersion);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported fixture entry: ${sourcePath}`);
    }

    const targetPath = relativePath === ".gitignore" ? "_gitignore" : relativePath;
    const source = await readFile(sourcePath);
    files.set(
      targetPath,
      transformFile(relativePath, source, styleguideVersion),
    );
  }
}

/**
 * @param {string} relativePath
 * @param {Buffer} source
 * @param {string} styleguideVersion
 * @returns {Buffer}
 */
function transformFile(relativePath, source, styleguideVersion) {
  if (relativePath === "package.json") {
    const packageJson = JSON.parse(source.toString("utf8"));
    packageJson.name = "__PROJECT_NAME__";
    packageJson.version = "0.1.0";
    if (
      !packageJson.dependencies ||
      typeof packageJson.dependencies !== "object" ||
      Array.isArray(packageJson.dependencies)
    ) {
      throw new Error("fixtures/engine-host/package.json has no dependencies object");
    }
    if (!("@takazudo/zudo-sg" in packageJson.dependencies)) {
      throw new Error(
        "fixtures/engine-host/package.json is missing @takazudo/zudo-sg",
      );
    }
    packageJson.dependencies["@takazudo/zudo-sg"] = `^${styleguideVersion}`;
    return Buffer.from(`${JSON.stringify(packageJson, null, 2)}\n`);
  }

  if (relativePath === "zfb.config.ts") {
    const text = source.toString("utf8");
    const next = text.replace(
      /base:\s*["']\/styleguide\/["']/,
      'base: "/"',
    );
    if (next === text) {
      throw new Error(
        'Expected zfb.config.ts to contain base: "/styleguide/"',
      );
    }
    return Buffer.from(next);
  }

  if (relativePath === ".gitignore") {
    const next = source
      .toString("utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== ".tarball")
      .join("\n");
    return Buffer.from(next);
  }

  return source;
}

/**
 * Read a generated/committed tree. Missing directories are represented by an
 * empty map so --check can report every expected path instead of failing on
 * the first missing file.
 *
 * @param {string} directory
 * @returns {Promise<TemplateTree>}
 */
export async function readTemplateTree(directory) {
  /** @type {TemplateTree} */
  const files = new Map();
  try {
    await collectExistingFiles(files, directory, "");
  } catch (error) {
    if (isMissingPathError(error)) return files;
    throw error;
  }
  return new Map([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * @param {TemplateTree} files
 * @param {string} directory
 * @param {string} relativeDirectory
 */
async function collectExistingFiles(files, directory, relativeDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = join(directory, entry.name);
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      await collectExistingFiles(files, filePath, relativePath);
    } else if (entry.isFile()) {
      files.set(relativePath, await readFile(filePath));
    } else {
      throw new Error(`Unsupported template entry: ${filePath}`);
    }
  }
}

/**
 * Return changed paths in a deterministic order. A path is reported once even
 * when the current tree is missing it and the expected tree also has content.
 *
 * @param {TemplateTree} expected
 * @param {TemplateTree} current
 * @returns {string[]}
 */
export function diffTemplateTrees(expected, current) {
  const paths = new Set([...expected.keys(), ...current.keys()]);
  return [...paths]
    .sort()
    .filter((path) => {
      const expectedContent = expected.get(path);
      const currentContent = current.get(path);
      if (!expectedContent || !currentContent) return true;
      return !expectedContent.equals(currentContent);
    });
}

/**
 * @param {TemplateTree} expected
 * @param {string} targetDir
 */
async function writeTemplate(expected, targetDir) {
  // The destination is entirely generated. Replacing it makes stale files
  // disappear and keeps the committed tree exactly equal to the source tree.
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await Promise.all(
    [...expected.entries()].map(async ([relativePath, content]) => {
      const targetPath = join(targetDir, ...relativePath.split("/"));
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content);
    }),
  );
}

function isMissingPathError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

/**
 * @param {{check?: boolean, sourceDir?: string, targetDir?: string, styleguidePackagePath?: string}} [options]
 */
export async function syncTemplate({
  check = false,
  sourceDir = SOURCE_DIR,
  targetDir = TARGET_DIR,
  styleguidePackagePath = STYLEGUIDE_PACKAGE_PATH,
} = {}) {
  const expected = await buildTemplate({ sourceDir, styleguidePackagePath });
  const current = await readTemplateTree(targetDir);
  const driftedPaths = diffTemplateTrees(expected, current);

  if (check) {
    if (driftedPaths.length > 0) {
      console.error("create-zudo-sg template drift detected:");
      for (const path of driftedPaths) console.error(`  ${path}`);
      console.error("Run `pnpm sync:create-template` to regenerate it.");
      return 1;
    }
    console.log("OK — create-zudo-sg template is up to date.");
    return 0;
  }

  if (driftedPaths.length === 0) {
    console.log("create-zudo-sg template already up to date; no change.");
    return 0;
  }

  await writeTemplate(expected, targetDir);
  console.log(`Wrote create-zudo-sg template (${expected.size} files).`);
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const unknown = argv.filter((argument) => argument !== "--check");
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(" ")}`);
  }
  return syncTemplate({ check: argv.includes("--check") });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().then(
    (status) => {
      process.exitCode = status;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
