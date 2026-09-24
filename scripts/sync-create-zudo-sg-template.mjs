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

import { realpathSync } from "node:fs";
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
export const ZFB_PACKAGE_PATH = join(
  ROOT_DIR,
  "node_modules",
  "@takazudo",
  "zfb",
  "package.json",
);

const RELEASE_AGE_DEPENDENCY_NAMES = [
  "@takazudo/zfb",
  "@takazudo/zfb-runtime",
  "@takazudo/zfb-md-wasm",
  "@takazudo/zudo-doc",
  "@takazudo/zdtp",
];
const EXACT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

const SKIPPED_NAMES = new Set([
  "node_modules",
  "dist",
  ".zfb-build",
  ".zfb",
  ".tarball",
  "pnpm-lock.yaml",
]);
const SKIPPED_FILE_PATTERNS = [
  /^\.zfb-esbuild-entry-.*\.tsx$/u,
  /^\.zfb-islands-tsconfig-.*\.json$/u,
  /^\.zfb-virtual-.*\.mjs$/u,
];

/** @typedef {Map<string, Buffer>} TemplateTree */

/**
 * Read a fixture tree and apply the starter-only transforms in memory.
 *
 * @param {{sourceDir?: string, styleguidePackagePath?: string, zfbPackagePath?: string}} [options]
 * @returns {Promise<TemplateTree>}
 */
export async function buildTemplate({
  sourceDir = SOURCE_DIR,
  styleguidePackagePath = STYLEGUIDE_PACKAGE_PATH,
  zfbPackagePath = ZFB_PACKAGE_PATH,
} = {}) {
  const styleguidePackage = JSON.parse(
    await readFile(styleguidePackagePath, "utf8"),
  );
  const styleguideVersion = exactVersion(
    styleguidePackage.version,
    `version in ${relative(ROOT_DIR, styleguidePackagePath)}`,
  );
  const releaseAgeExcludes = await buildReleaseAgeExcludes(
    sourceDir,
    styleguideVersion,
    zfbPackagePath,
  );

  /** @type {TemplateTree} */
  const files = new Map();
  await collectFiles(files, sourceDir, "", styleguideVersion, releaseAgeExcludes);
  return new Map([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Derive the starter's release-age exemptions from the versions it ships.
 * Keeping this based on package metadata makes the generated workspace follow
 * dependency updates without requiring a second hand-maintained version list.
 *
 * @param {string} sourceDir
 * @param {string} styleguideVersion
 * @param {string} zfbPackagePath
 * @returns {Promise<string[]>}
 */
async function buildReleaseAgeExcludes(sourceDir, styleguideVersion, zfbPackagePath) {
  const fixturePackagePath = join(sourceDir, "package.json");
  const fixturePackage = JSON.parse(await readFile(fixturePackagePath, "utf8"));
  const dependencies = fixturePackage.dependencies;
  if (
    !dependencies ||
    typeof dependencies !== "object" ||
    Array.isArray(dependencies)
  ) {
    throw new Error(`${fixturePackagePath} has no dependencies object`);
  }

  const versions = new Map();
  for (const name of RELEASE_AGE_DEPENDENCY_NAMES) {
    versions.set(
      name,
      exactVersion(
        dependencies[name],
        `${name} dependency in ${fixturePackagePath}`,
      ),
    );
  }

  const zfbPackage = JSON.parse(await readFile(zfbPackagePath, "utf8"));
  const zfbVersion = versions.get("@takazudo/zfb");
  const metadataVersion = exactVersion(
    zfbPackage.version,
    `version in ${zfbPackagePath}`,
  );
  if (metadataVersion !== zfbVersion) {
    throw new Error(
      `@takazudo/zfb metadata version ${metadataVersion} does not match the fixture pin ${zfbVersion}`,
    );
  }

  const optionalDependencies = zfbPackage.optionalDependencies;
  if (
    !optionalDependencies ||
    typeof optionalDependencies !== "object" ||
    Array.isArray(optionalDependencies) ||
    Object.keys(optionalDependencies).length === 0
  ) {
    throw new Error(
      `Expected @takazudo/zfb metadata at ${zfbPackagePath} to include optionalDependencies`,
    );
  }

  const entries = [
    ...RELEASE_AGE_DEPENDENCY_NAMES.map((name) => `${name}@${versions.get(name)}`),
    `@takazudo/zudo-sg@${styleguideVersion}`,
  ];
  for (const [name, version] of Object.entries(optionalDependencies)) {
    const optionalVersion = exactVersion(
      version,
      `${name} optional dependency in ${zfbPackagePath}`,
    );
    if (optionalVersion !== zfbVersion) {
      throw new Error(
        `${name} optional dependency version ${optionalVersion} does not match the @takazudo/zfb pin ${zfbVersion}`,
      );
    }
    entries.push(`${name}@${optionalVersion}`);
  }

  return entries.sort(compareStrings);
}

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @param {unknown} version
 * @param {string} description
 * @returns {string}
 */
function exactVersion(version, description) {
  if (typeof version !== "string" || !EXACT_SEMVER.test(version)) {
    throw new Error(`Expected an exact semver for ${description}; received ${String(version)}`);
  }
  return version;
}

/**
 * @param {TemplateTree} files
 * @param {string} directory
 * @param {string} relativeDirectory
 * @param {string} styleguideVersion
 * @param {string[]} releaseAgeExcludes
 */
async function collectFiles(
  files,
  directory,
  relativeDirectory,
  styleguideVersion,
  releaseAgeExcludes,
) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (
      SKIPPED_NAMES.has(entry.name) ||
      SKIPPED_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))
    ) {
      continue;
    }

    const sourcePath = join(directory, entry.name);
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      await collectFiles(
        files,
        sourcePath,
        relativePath,
        styleguideVersion,
        releaseAgeExcludes,
      );
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported fixture entry: ${sourcePath}`);
    }

    const targetPath = relativePath === ".gitignore" ? "_gitignore" : relativePath;
    const source = await readFile(sourcePath);
    files.set(
      targetPath,
      transformFile(relativePath, source, styleguideVersion, releaseAgeExcludes),
    );
  }
}

/**
 * @param {string} relativePath
 * @param {Buffer} source
 * @param {string} styleguideVersion
 * @param {string[]} releaseAgeExcludes
 * @returns {Buffer}
 */
function transformFile(relativePath, source, styleguideVersion, releaseAgeExcludes) {
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
      .filter((line) => ![".tarball", "pnpm-lock.yaml"].includes(line.trim()))
      .join("\n");
    return Buffer.from(next);
  }

  if (relativePath === "pnpm-workspace.yaml") {
    return transformWorkspace(source, releaseAgeExcludes);
  }

  return source;
}

/**
 * @param {Buffer} source
 * @param {string[]} releaseAgeExcludes
 * @returns {Buffer}
 */
function transformWorkspace(source, releaseAgeExcludes) {
  const text = source.toString("utf8");
  const lineEnding = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/u);
  const keyIndex = lines.findIndex((line) => /^minimumReleaseAgeExclude:\s*$/u.test(line));
  if (keyIndex === -1) {
    throw new Error(
      "fixtures/engine-host/pnpm-workspace.yaml is missing minimumReleaseAgeExclude",
    );
  }

  let endIndex = keyIndex + 1;
  while (
    endIndex < lines.length &&
    /^[ \t]/u.test(lines[endIndex])
  ) {
    endIndex += 1;
  }

  const replacement = [
    "minimumReleaseAgeExclude:",
    ...releaseAgeExcludes.map((entry) => `  - "${entry}"`),
  ];
  lines.splice(keyIndex, endIndex - keyIndex, ...replacement);
  return Buffer.from(lines.join(lineEnding));
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
 * @param {{check?: boolean, sourceDir?: string, targetDir?: string, styleguidePackagePath?: string, zfbPackagePath?: string}} [options]
 */
export async function syncTemplate({
  check = false,
  sourceDir = SOURCE_DIR,
  targetDir = TARGET_DIR,
  styleguidePackagePath = STYLEGUIDE_PACKAGE_PATH,
  zfbPackagePath = ZFB_PACKAGE_PATH,
} = {}) {
  const expected = await buildTemplate({
    sourceDir,
    styleguidePackagePath,
    zfbPackagePath,
  });
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
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
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
