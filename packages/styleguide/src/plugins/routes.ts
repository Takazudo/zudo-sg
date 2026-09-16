// zfb plugin module: @takazudo/zudo-sg/plugins/routes — package-owned catalog
// routes (ADR docs/adr/styleguide-engine.md decisions 6, 9, 10). Model:
// @takazudo/zudo-doc's plugins/routes.ts.
//
// Hosts reference it as a bare-specifier descriptor
// (`{ name: "@takazudo/zudo-sg/plugins/routes", options }`), never an imported
// function, so the config eval graph stays node-free. zfb's Node plugin host
// loads this file from `dist/plugins/routes.js`.
//
// `setup(ctx)`:
//   1. normalizes the options and resolves `registryModule` through the shared
//      host-path contract (throws with the option name + resolved path);
//   2. requires the `@takazudo/zudo-doc/plugins/routes` descriptor — the engine
//      routes import `virtual:zudo-doc-route-context` /
//      `virtual:zudo-doc-chrome-bindings`, which only that plugin registers;
//   3. registers `virtual:zudo-sg-context` (JSON data only),
//      `virtual:zudo-sg-registry` (re-export of the host registry file) and
//      `virtual:zudo-sg-tokens` (the `/tokens` route's design-token manifest,
//      assembled from the host `tokensManifestModule` or `null`);
//   4. injects the four routes, pointing at `routes-src/<entry>.tsx` under this
//      package's own realpath.
//
// NO STAGING (ADR spike findings 1–2): zfb 2.16 resolves virtual modules from
// entrypoints whose realpath is under `node_modules/.pnpm/…` directly, so a
// `.zudo-sg/` stage dir is never needed here — zudo-doc 5.25 retired its own
// `.zudo-doc/routes-src` staging step for the same reason. Entrypoints must
// be `.tsx` SOURCE: zfb extracts `paths()` by AST and rejects compiled `.js`.

import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { ZfbPlugin, ZfbSetupContext } from "@takazudo/zfb/plugins";
import { resolveHostModule, toForwardSlash } from "../host-paths.js";
import type { ComponentDocsRoot } from "../registry/component-docs.js";
import {
  DEFAULT_CATALOG_TITLE,
  DEFAULT_PREVIEW_CSS_URL,
  type SgCatalogText,
  type SgContext,
} from "../sg-context.js";
import { DEFAULT_SG_ROUTES, type SgRoutes } from "../sg-routes.js";

export const PLUGIN_NAME = "@takazudo/zudo-sg/plugins/routes";

/** The zudo-doc plugin whose virtual modules the engine routes import. */
export const ZUDO_DOC_ROUTES_PLUGIN_NAME = "@takazudo/zudo-doc/plugins/routes";

export const CONTEXT_MODULE_ID = "virtual:zudo-sg-context";
export const REGISTRY_MODULE_ID = "virtual:zudo-sg-registry";
export const TOKENS_MODULE_ID = "virtual:zudo-sg-tokens";

/**
 * Named exports of a `zudo-sg gen-token-manifest` output file, keyed by the
 * `UiDesignTokensManifest` field each one fills (see
 * cli/token-manifest/ui-token-manifest.ts).
 */
export const TOKENS_MANIFEST_EXPORTS: Readonly<Record<string, string>> = Object.freeze({
  paletteColors: "UI_PALETTE_COLORS",
  colorTokens: "UI_COLOR_TOKENS",
  spacingTokens: "UI_SPACING_TOKENS",
  fontTokens: "UI_FONT_TOKENS",
  sizeTokens: "UI_SIZE_TOKENS",
});

/** Route key → `routes-src/` entrypoint file (ADR decision 6). */
export const ROUTE_ENTRYPOINTS: Readonly<Record<keyof SgRoutes, string>> = Object.freeze({
  componentsIndex: "components-index.tsx",
  componentsSlug: "components-slug.tsx",
  componentsPreview: "components-preview.tsx",
  tokens: "tokens.tsx",
});

export interface RoutesPluginOptions {
  /** Project-root-relative path to the generated host registry (`zudo-sg.config.mjs` `registryOut`). */
  registryModule: string;
  routes?: Partial<SgRoutes>;
  categoryOrder?: string[];
  uiPackageName?: string;
  previewCssUrl?: string;
  catalog?: { title?: string; intro?: string };
  /**
   * Project-root-relative generated token manifest (`zudo-sg.config.mjs`
   * `tokens.manifestOut`). Addition beyond the ADR's locked option list: the
   * `/tokens` route has no other channel to the host manifest. Omitted → the
   * route renders without dashboards.
   */
  tokensManifestModule?: string;
  /**
   * Per components root: its `storyModules` key prefix (e.g. `"ui/src"`) and
   * the content collection holding its MDX docs. `zudoSg()` fills this from
   * `componentsRoots`; omitted → detail pages render no component docs.
   */
  componentDocs?: ComponentDocsRoot[];
}

export interface ResolvedRoutesPluginOptions {
  /** Forward-slash absolute path of the host registry file. */
  registryModule: string;
  routes: SgRoutes;
  categoryOrder: string[];
  uiPackageName: string | null;
  previewCssUrl: string;
  catalog: SgCatalogText;
  /** Forward-slash absolute path of the host token manifest, or `null`. */
  tokensManifestModule: string | null;
  componentDocs: ComponentDocsRoot[];
}

export interface RouteInjection {
  key: keyof SgRoutes;
  pattern: string;
  /** Forward-slash absolute path of the `routes-src/*.tsx` entrypoint. */
  entrypoint: string;
}

const OPTION_KEYS = new Set([
  "registryModule",
  "routes",
  "categoryOrder",
  "uiPackageName",
  "previewCssUrl",
  "catalog",
  "tokensManifestModule",
  "componentDocs",
]);
const ROUTE_KEYS = Object.keys(DEFAULT_SG_ROUTES) as Array<keyof SgRoutes>;
const CATALOG_KEYS = new Set(["title", "intro"]);

function fail(message: string): never {
  throw new Error(`[zudo-sg] ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(name: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value === "") fail(`option "${name}" must be a non-empty string`);
  return value;
}

function urlPath(name: string, value: string): string {
  if (!value.startsWith("/")) fail(`option "${name}" = "${value}" must be a root-absolute path starting with "/"`);
  return value;
}

function normalizeRoutes(value: unknown): SgRoutes {
  if (value === undefined || value === null) return { ...DEFAULT_SG_ROUTES };
  if (!isPlainObject(value)) fail(`option "routes" must be an object`);
  for (const key of Object.keys(value)) {
    if (!(ROUTE_KEYS as string[]).includes(key)) {
      fail(`option "routes.${key}" is not a known route (expected one of ${ROUTE_KEYS.join(", ")})`);
    }
  }
  const routes = { ...DEFAULT_SG_ROUTES };
  for (const key of ROUTE_KEYS) {
    const pattern = optionalString(`routes.${key}`, value[key]);
    if (pattern !== undefined) routes[key] = urlPath(`routes.${key}`, pattern);
  }
  if (!routes.componentsSlug.includes("[slug]")) {
    fail(`option "routes.componentsSlug" = "${routes.componentsSlug}" must contain the "[slug]" segment`);
  }
  const seen = new Map<string, keyof SgRoutes>();
  for (const key of ROUTE_KEYS) {
    const other = seen.get(routes[key]);
    if (other) fail(`options "routes.${other}" and "routes.${key}" both resolve to "${routes[key]}"`);
    seen.set(routes[key], key);
  }
  return routes;
}

function normalizeCategoryOrder(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((c) => typeof c !== "string")) {
    fail(`option "categoryOrder" must be an array of strings`);
  }
  return [...value];
}

function normalizeCatalog(value: unknown): SgCatalogText {
  if (value === undefined || value === null) return { title: DEFAULT_CATALOG_TITLE, intro: null };
  if (!isPlainObject(value)) fail(`option "catalog" must be an object ({ title?, intro? })`);
  for (const key of Object.keys(value)) {
    if (!CATALOG_KEYS.has(key)) fail(`option "catalog.${key}" is not supported (expected title, intro)`);
  }
  return {
    title: optionalString("catalog.title", value.title) ?? DEFAULT_CATALOG_TITLE,
    intro: optionalString("catalog.intro", value.intro) ?? null,
  };
}

function normalizeComponentDocs(value: unknown): ComponentDocsRoot[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`option "componentDocs" must be an array of { keyPrefix, collection }`);
  return value.map((item, i) => {
    if (!isPlainObject(item)) fail(`option "componentDocs[${i}]" must be an object ({ keyPrefix, collection })`);
    for (const key of Object.keys(item)) {
      if (key !== "keyPrefix" && key !== "collection") {
        fail(`option "componentDocs[${i}].${key}" is not supported (expected keyPrefix, collection)`);
      }
    }
    const keyPrefix = optionalString(`componentDocs[${i}].keyPrefix`, item.keyPrefix);
    const collection = optionalString(`componentDocs[${i}].collection`, item.collection);
    if (keyPrefix === undefined || collection === undefined) {
      fail(`option "componentDocs[${i}]" requires non-empty "keyPrefix" and "collection" strings`);
    }
    return { keyPrefix, collection };
  });
}

/** Validates the options block and resolves `registryModule`; throws `[zudo-sg] …` on invalid input. */
export function resolveRoutesPluginOptions(
  projectRoot: string,
  options: Record<string, unknown>,
): ResolvedRoutesPluginOptions {
  for (const key of Object.keys(options)) {
    if (!OPTION_KEYS.has(key)) {
      fail(`unknown option "${key}" for ${PLUGIN_NAME} (expected one of ${[...OPTION_KEYS].join(", ")})`);
    }
  }
  const registryValue = options.registryModule;
  if (registryValue !== undefined && registryValue !== null && typeof registryValue !== "string") {
    fail(`option "registryModule" must be a string (project-root-relative path)`);
  }
  const registryModule = resolveHostModule(projectRoot, "registryModule", registryValue, {
    required: true,
    example: "./src/styleguide/sg-registry.ts",
  });
  const previewCssUrl = optionalString("previewCssUrl", options.previewCssUrl);
  const tokensValue = options.tokensManifestModule;
  if (tokensValue !== undefined && tokensValue !== null && typeof tokensValue !== "string") {
    fail(`option "tokensManifestModule" must be a string (project-root-relative path)`);
  }
  const tokensManifestModule = resolveHostModule(projectRoot, "tokensManifestModule", tokensValue, {
    example: "./src/config/ui-design-tokens-manifest.ts",
  });

  return {
    registryModule,
    routes: normalizeRoutes(options.routes),
    categoryOrder: normalizeCategoryOrder(options.categoryOrder),
    uiPackageName: optionalString("uiPackageName", options.uiPackageName) ?? null,
    previewCssUrl: previewCssUrl === undefined ? DEFAULT_PREVIEW_CSS_URL : urlPath("previewCssUrl", previewCssUrl),
    catalog: normalizeCatalog(options.catalog),
    tokensManifestModule: tokensManifestModule ?? null,
    componentDocs: normalizeComponentDocs(options.componentDocs),
  };
}

/** Throws unless the zfb config lists the zudo-doc routes plugin descriptor. */
export function assertZudoDocRoutesPlugin(config: ZfbSetupContext["config"]): void {
  const plugins = Array.isArray(config.plugins) ? config.plugins : [];
  if (plugins.some((plugin) => plugin?.name === ZUDO_DOC_ROUTES_PLUGIN_NAME)) return;
  fail(
    `${PLUGIN_NAME} requires the "${ZUDO_DOC_ROUTES_PLUGIN_NAME}" plugin in the zfb config — ` +
      `the engine routes import virtual:zudo-doc-route-context and virtual:zudo-doc-chrome-bindings, ` +
      `which only that plugin registers. Set packageOwnedRoutes: true in the zudo-doc settings and list ` +
      `the zudo-doc preset's plugins before the zudo-sg plugins.`,
  );
}

/** Builds the JSON-only `sgContext` payload. */
export function buildSgContext(base: string | undefined, resolved: ResolvedRoutesPluginOptions): SgContext {
  return {
    base: base === undefined || base === "" ? "/" : base,
    routes: resolved.routes,
    categoryOrder: resolved.categoryOrder,
    uiPackageName: resolved.uiPackageName,
    previewCssUrl: resolved.previewCssUrl,
    catalog: resolved.catalog,
    componentDocs: resolved.componentDocs,
  };
}

export function buildContextModuleSource(context: SgContext): string {
  return `export const sgContext = ${JSON.stringify(context)};\n`;
}

export function buildRegistryModuleSource(registryModule: string): string {
  return `export { storyModules, storyExportOrder } from ${JSON.stringify(toForwardSlash(registryModule))};\n`;
}

export function buildTokensModuleSource(tokensManifestModule: string | null): string {
  if (tokensManifestModule === null) return "export const tokensManifest = null;\n";
  const names = Object.values(TOKENS_MANIFEST_EXPORTS);
  const fields = Object.entries(TOKENS_MANIFEST_EXPORTS).map(([field, name]) => `${field}: ${name}`);
  return (
    `import { ${names.join(", ")} } from ${JSON.stringify(toForwardSlash(tokensManifestModule))};\n` +
    `export const tokensManifest = { ${fields.join(", ")} };\n`
  );
}

/**
 * This package's own root realpath — the workspace dir or
 * `node_modules/.pnpm/…/@takazudo/zudo-sg`, whichever the plugin loaded from.
 */
export function resolvePackageRoot(): string {
  const require = createRequire(import.meta.url);
  return toForwardSlash(dirname(realpathSync(require.resolve("@takazudo/zudo-sg/package.json"))));
}

/** Pairs every route pattern with its `routes-src/` entrypoint under `packageRoot`. */
export function deriveRouteInjections(routes: SgRoutes, packageRoot: string): RouteInjection[] {
  const routesSrc = toForwardSlash(join(packageRoot, "routes-src"));
  return ROUTE_KEYS.map((key) => ({
    key,
    pattern: routes[key],
    entrypoint: `${routesSrc}/${ROUTE_ENTRYPOINTS[key]}`,
  }));
}

export interface CreateRoutesPluginOptions {
  /** Test seam: overrides the package realpath lookup. */
  packageRoot?: () => string;
}

export function createRoutesPlugin({ packageRoot = resolvePackageRoot }: CreateRoutesPluginOptions = {}): ZfbPlugin {
  return {
    name: PLUGIN_NAME,

    setup(ctx: ZfbSetupContext) {
      const resolved = resolveRoutesPluginOptions(ctx.projectRoot, ctx.options);
      assertZudoDocRoutesPlugin(ctx.config);

      const injections = deriveRouteInjections(resolved.routes, packageRoot());
      for (const { entrypoint } of injections) {
        if (!existsSync(entrypoint)) {
          fail(
            `route entrypoint ${entrypoint} is missing — build @takazudo/zudo-sg ` +
              `(routes-src/ is generated by scripts/copy-routes-src.mjs)`,
          );
        }
      }

      const context = buildSgContext(ctx.config.base, resolved);
      ctx.addVirtualModule(CONTEXT_MODULE_ID, () => buildContextModuleSource(context));
      ctx.addVirtualModule(REGISTRY_MODULE_ID, () => buildRegistryModuleSource(resolved.registryModule));
      ctx.addVirtualModule(TOKENS_MODULE_ID, () => buildTokensModuleSource(resolved.tokensManifestModule));

      for (const { pattern, entrypoint } of injections) {
        ctx.injectRoute(pattern, entrypoint);
      }
    },
  };
}

export default createRoutesPlugin();
