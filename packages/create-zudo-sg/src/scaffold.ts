import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  readlink,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_NAME_MAX = 214;
const PACKAGE_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
const SCOPED_PACKAGE_NAME_RE = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;

/** The package template shipped by create-zudo-sg. */
export const DEFAULT_TEMPLATE_DIR = resolveTemplateDirectory();

function resolveTemplateDirectory(): string {
  const templateUrl = new URL("../templates/default/", import.meta.url);
  if (templateUrl.protocol === "file:") return fileURLToPath(templateUrl);

  // Vite's root test runner rewrites import.meta.url to an HTTP URL. The
  // package itself always runs from a file URL, but keeping this fallback
  // makes the exported constant safe for the root vitest config too.
  const pathname = decodeURIComponent(templateUrl.pathname).replace(
    /^\/\@fs\//,
    "/",
  );
  // In the monorepo's root Vite runner, module URLs are rooted at
  // `/packages/...` rather than the filesystem root.
  return pathname.startsWith("/packages/")
    ? resolve(process.cwd(), pathname.slice(1))
    : pathname;
}

export interface ScaffoldOptions {
  /** Directory to write the generated project into. */
  targetDir: string;
  /** Package name written to the generated package.json. */
  projectName: string;
  /** Template directory. Defaults to the package's templates/default tree. */
  templateDir?: string;
}

/**
 * Validate a package name using npm's lowercase package-name grammar.
 *
 * The initializer accepts scoped names for `--name`, while a directory's
 * basename normally produces an unscoped name. Returning an error string
 * keeps validation useful from both the CLI and the programmatic API.
 */
export function validateProjectName(name: string): string | null {
  if (name.length === 0) return "Project name is required";
  if (name.length > PROJECT_NAME_MAX) {
    return `Project name must be ${PROJECT_NAME_MAX} characters or fewer`;
  }

  const valid = name.startsWith("@")
    ? SCOPED_PACKAGE_NAME_RE.test(name)
    : PACKAGE_NAME_RE.test(name);
  if (!valid || name === "node_modules") {
    return (
      "Project name must be a valid npm package name: start with a lowercase " +
      "letter or digit (or use @scope/name), and contain only lowercase " +
      "letters, digits, dots, underscores, and hyphens"
    );
  }
  return null;
}

export function isValidPackageName(name: string): boolean {
  return validateProjectName(name) === null;
}

/** Compatibility-friendly name for callers that think in npm terms. */
export const validatePackageName = validateProjectName;

async function assertEmptyTarget(targetDir: string): Promise<void> {
  try {
    const targetStats = await stat(targetDir);
    if (!targetStats.isDirectory()) {
      throw new Error(`Target path "${targetDir}" is not a directory`);
    }
    const entries = await readdir(targetDir);
    if (entries.length > 0) {
      throw new Error(
        `Directory "${targetDir}" already exists and is not empty`,
      );
    }
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }
}

async function assertDirectory(directory: string, label: string): Promise<void> {
  let directoryStats;
  try {
    directoryStats = await stat(directory);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(`${label} does not exist: "${directory}"`);
    }
    throw error;
  }
  if (!directoryStats.isDirectory()) {
    throw new Error(`${label} is not a directory: "${directory}"`);
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

/**
 * Copy a template tree while translating `_gitignore` to `.gitignore`.
 *
 * npm omits `.gitignore` from published package tarballs, so the committed
 * template uses `_gitignore` and the rename happens only while scaffolding.
 */
async function copyTemplateTree(sourceDir: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetName = entry.name === "_gitignore" ? ".gitignore" : entry.name;
    const targetPath = join(targetDir, targetName);

    if (entry.isDirectory()) {
      await copyTemplateTree(sourcePath, targetPath);
    } else if (entry.isSymbolicLink()) {
      await symlink(await readlink(sourcePath), targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    } else {
      throw new Error(`Unsupported template entry: "${sourcePath}"`);
    }
  }
}

/**
 * Scaffold a project from a template directory.
 *
 * The explicit template parameter is intentional: unit tests can supply a
 * tiny fixture and remain independent of the separately synchronized
 * templates/default tree.
 */
export async function scaffold(
  options: ScaffoldOptions,
): Promise<string>;
export async function scaffold(
  targetDir: string,
  projectName: string,
  templateDir?: string,
): Promise<string>;
export async function scaffold(
  optionsOrTargetDir: ScaffoldOptions | string,
  projectName?: string,
  templateDir = DEFAULT_TEMPLATE_DIR,
): Promise<string> {
  const options: ScaffoldOptions =
    typeof optionsOrTargetDir === "string"
      ? {
          targetDir: optionsOrTargetDir,
          projectName: projectName ?? basename(resolve(optionsOrTargetDir)),
          templateDir,
        }
      : optionsOrTargetDir;

  const nameError = validateProjectName(options.projectName);
  if (nameError) throw new Error(`Invalid project name: ${nameError}`);

  const targetDir = resolve(options.targetDir);
  const sourceDir = resolve(options.templateDir ?? DEFAULT_TEMPLATE_DIR);
  await assertDirectory(sourceDir, "Template directory");

  // Validate the source before creating a target, so a malformed package
  // cannot leave a partially generated project behind.
  const sourcePackageJson = await readFile(join(sourceDir, "package.json"), "utf8");
  await assertEmptyTarget(targetDir);
  await mkdir(targetDir, { recursive: true });
  await copyTemplateTree(sourceDir, targetDir);

  const targetPackageJson = join(targetDir, "package.json");
  // Preserve the template's formatting and any comments-like spacing while
  // replacing every occurrence of the one scaffold token.
  const packageJson = sourcePackageJson.replaceAll(
    "__PROJECT_NAME__",
    options.projectName,
  );
  await writeFile(targetPackageJson, packageJson);

  return targetDir;
}
