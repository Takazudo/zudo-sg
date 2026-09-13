// Shared host-path contract (ADR docs/adr/styleguide-engine.md decision 10).
//
// Every engine option that names a host file (`registryModule`,
// `previewStyles`, the CLI's `registryOut`, …) is a project-root-relative path
// string (absolute accepted). It resolves against the HOST project root — never
// against this package's own location, which differs between a workspace link,
// a packed pnpm install (`node_modules/.pnpm/…`) and a plain npm install — and
// must name an existing file. The result is a forward-slash absolute path that
// virtual modules re-export verbatim (zfb remaps it into its shadow tree).

import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface ResolveHostModuleOptions {
  /** Throw when the option is absent (`undefined` / `null`). */
  required?: boolean;
  /** Example value quoted in the "is required" error, e.g. `./src/styleguide/sg-registry.ts`. */
  example?: string;
}

/** Converts a native path to forward slashes (`C:\a\b` → `C:/a/b`). */
export function toForwardSlash(path: string): string {
  return path.replace(/\\/g, "/");
}

function isFile(absPath: string): boolean {
  try {
    return statSync(absPath).isFile();
  } catch {
    return false;
  }
}

export function resolveHostModule(
  projectRoot: string,
  optionName: string,
  value: string | null | undefined,
  options: ResolveHostModuleOptions & { required: true },
): string;
export function resolveHostModule(
  projectRoot: string,
  optionName: string,
  value: string | null | undefined,
  options?: ResolveHostModuleOptions,
): string | undefined;
/**
 * Resolves a host-path option against `projectRoot` and asserts it is a file.
 * Returns `undefined` only when the option is absent and not required.
 * An empty string counts as present (and fails the file check).
 */
export function resolveHostModule(
  projectRoot: string,
  optionName: string,
  value: string | null | undefined,
  options: ResolveHostModuleOptions = {},
): string | undefined {
  if (value === undefined || value === null) {
    if (!options.required) return undefined;
    const example = options.example ?? "./path/to/file";
    throw new Error(
      `[zudo-sg] option "${optionName}" is required (project-root-relative path, e.g. "${example}")`,
    );
  }

  const root = toForwardSlash(resolve(projectRoot));
  const abs = toForwardSlash(isAbsolute(value) ? resolve(value) : resolve(projectRoot, value));
  if (value === "" || !isFile(abs)) {
    throw new Error(
      `[zudo-sg] option "${optionName}" = "${value}" resolved to ${abs} (relative to projectRoot ${root}), which is not a file`,
    );
  }
  return abs;
}

/** Removes every trailing `/` (`"/docs/"` → `"/docs"`, `"/"` → `""`). */
export function stripTrailingSlash(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Prefixes a root-absolute URL path with the site base:
 * `withBaseUrl("/docs/", "/_zudo-sg/preview.css")` → `"/docs/_zudo-sg/preview.css"`.
 */
export function withBaseUrl(base: string, path: string): string {
  return stripTrailingSlash(base) + path;
}
