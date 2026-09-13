// The `zudo-sg` CLI's host config — `zudo-sg.config.mjs` at the host
// project root (ADR docs/adr/styleguide-engine.md decision 10). Every path
// field is project-root-relative (resolved against `projectRoot`, not this
// package's own location — see host-paths.ts).

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** One corpus of `*.stories.tsx` files the registry codegen discovers. */
export interface ZudoSgComponentsRoot {
  /** Project-root-relative directory to scan, e.g. "packages/ui/src". */
  dir: string;
  /** Package-scoped import specifier prefix for files under `dir`, e.g. "@zudo-sg/ui/src". */
  importBase: string;
}

export interface ZudoSgTokensConfig {
  /**
   * `[tokensCssPath, colorsCssPath]` — project-root-relative. Position is
   * significant: index 0 feeds spacing/font/size tokens, index 1 feeds the
   * palette + semantic color tokens (see token-manifest/ui-token-manifest.ts).
   */
  cssFiles: [string, string];
  /** Project-root-relative output path for the generated manifest. */
  manifestOut: string;
}

export interface ZudoSgConfig {
  componentsRoots: ZudoSgComponentsRoot[];
  /** Project-root-relative output path for the generated story registry. */
  registryOut: string;
  /**
   * Category display order. Categories not listed here are still valid —
   * they sort in alphabetically after these (see registry/registry.ts's
   * `computeCategoryOrder`).
   */
  categoryOrder: string[];
  /** npm package name components/stories are imported from in generated usage snippets. */
  uiPackageName: string;
  /**
   * Project-root-relative path to the barrel file `new-component` inserts an
   * export into, or `null` for a project with no barrel-file convention.
   */
  barrelIndex: string | null;
  /**
   * Design-token manifest inputs for `gen-token-manifest` and the `/tokens`
   * dashboards. Omitted → `gen-token-manifest` exits with an error and the
   * `/tokens` route renders an empty state.
   */
  tokens?: ZudoSgTokensConfig;
  /** Project-root-relative path to the host's preview stylesheet entry. */
  previewStyles: string;
  previewCssUrl?: string;
  routes?: Record<string, string>;
  catalog?: { title?: string; intro?: string };
}

const DEFAULT_CONFIG_FILE = "zudo-sg.config.mjs";

/**
 * Loads and returns the host's `zudo-sg.config.mjs` default export.
 * `configFile` is project-root-relative (defaults to `zudo-sg.config.mjs`).
 */
export async function loadZudoSgConfig(
  projectRoot: string,
  configFile: string = DEFAULT_CONFIG_FILE,
): Promise<ZudoSgConfig> {
  const abs = resolve(projectRoot, configFile);
  const mod = (await import(pathToFileURL(abs).href)) as { default: ZudoSgConfig };
  if (!mod.default) {
    throw new Error(`[zudo-sg] ${configFile} must have a default export (see ZudoSgConfig).`);
  }
  return mod.default;
}
