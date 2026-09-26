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
//   1. normalizes the options and resolves `registryModule` (module mode) or
//      `descriptorModule` (descriptor mode) through the shared host-path
//      contract (throws with the option name + resolved path);
//   2. requires the `@takazudo/zudo-doc/plugins/routes` descriptor — the engine
//      routes import `virtual:zudo-doc-route-context` /
//      `virtual:zudo-doc-chrome-bindings`, which only that plugin registers;
//   3. registers `virtual:zudo-sg-context` (JSON data only),
//      `virtual:zudo-sg-registry` (fixed shape in both modes: `storyModules`,
//      `storyExportOrder`, `storyDescriptors`) and
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
  type SgRegistryMode,
} from "../sg-context.js";
import {
  DEFAULT_SG_ROUTES,
  DISABLEABLE_ROUTE_KEYS,
  isTokensRouteEnabled,
  previewCollisionSlug,
  type SgRoutes,
  type SgRoutesOption,
} from "../sg-routes.js";

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
  /** Default `"module"`. `"descriptor"` reads plain-data story descriptors from `descriptorModule` instead. */
  registryMode?: SgRegistryMode;
  /** Module mode (required there): project-root-relative path to the generated host registry (`registryOut`). */
  registryModule?: string;
  /**
   * Descriptor mode (required there): project-root-relative module exporting
   * `StoryDescriptor[]` as the named export `storyDescriptors`, or — when that
   * export is absent — as its default export. Must sit inside the project root.
   */
  descriptorModule?: string;
  routes?: SgRoutesOption;
  /**
   * A host-served preview document that replaces the in-engine
   * `componentsPreview` route (which is then implied disabled). `url` must be
   * root-absolute (a single leading `/`, no scheme, no `//`); `trailingSlash`
   * normalizes it (`"never"` strips a trailing `/`, `"always"` adds one).
   * Required in descriptor mode: descriptors carry no render functions, so
   * the engine has nothing to render at an in-engine preview route.
   */
  externalPreview?: { url: string; trailingSlash?: "never" | "always" };
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

/** The resolved story source; both paths are forward-slash absolute. */
export type ResolvedRegistrySource =
  | { mode: "module"; registryModule: string }
  | { mode: "descriptor"; descriptorModule: string };

export interface ResolvedRoutesPluginOptions {
  registry: ResolvedRegistrySource;
  routes: SgRoutes;
  /** Route keys with no `injectRoute()` call — explicit `false` or implied (see `SgContext.disabledRoutes`). */
  disabledRoutes: Array<keyof SgRoutes>;
  /** Root-absolute URL of the host preview document, or `null` — see `RoutesPluginOptions.externalPreview`. */
  externalPreviewUrl: string | null;
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
  "registryMode",
  "registryModule",
  "descriptorModule",
  "routes",
  "externalPreview",
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

interface NormalizedRoutes {
  routes: SgRoutes;
  /** Route keys explicitly set to `false`. */
  disabledRoutes: Array<keyof SgRoutes>;
}

function normalizeRoutes(value: unknown): NormalizedRoutes {
  if (value === undefined || value === null) return { routes: { ...DEFAULT_SG_ROUTES }, disabledRoutes: [] };
  if (!isPlainObject(value)) fail(`option "routes" must be an object`);
  for (const key of Object.keys(value)) {
    if (!(ROUTE_KEYS as string[]).includes(key)) {
      fail(`option "routes.${key}" is not a known route (expected one of ${ROUTE_KEYS.join(", ")})`);
    }
  }
  const routes = { ...DEFAULT_SG_ROUTES };
  const disabledRoutes: Array<keyof SgRoutes> = [];
  for (const key of ROUTE_KEYS) {
    const raw = value[key];
    if (raw === false) {
      if (!DISABLEABLE_ROUTE_KEYS.has(key)) {
        fail(`option "routes.${key}" cannot be disabled — it is the engine's point (expected a string, or "false" for one of ${[...DISABLEABLE_ROUTE_KEYS].join(", ")})`);
      }
      disabledRoutes.push(key);
      continue;
    }
    const pattern = optionalString(`routes.${key}`, raw);
    if (pattern !== undefined) routes[key] = urlPath(`routes.${key}`, pattern);
  }
  if (!routes.componentsSlug.includes("[slug]")) {
    fail(`option "routes.componentsSlug" = "${routes.componentsSlug}" must contain the "[slug]" segment`);
  }
  // Validate the placeholder shape before route injection or paths() emission.
  previewCollisionSlug(routes);
  const seen = new Map<string, keyof SgRoutes>();
  for (const key of ROUTE_KEYS) {
    if (disabledRoutes.includes(key)) continue;
    const other = seen.get(routes[key]);
    if (other) fail(`options "routes.${other}" and "routes.${key}" both resolve to "${routes[key]}"`);
    seen.set(routes[key], key);
  }
  return { routes, disabledRoutes };
}

/** Root-absolute, single-leading-slash: rejects `http:`/`https:` (or any scheme), `//host`, and relative paths. */
function isRootAbsoluteUrl(value: string): boolean {
  return /^\/(?!\/)/.test(value);
}

function normalizeExternalPreview(value: unknown): { url: string } | null {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value)) fail(`option "externalPreview" must be an object ({ url, trailingSlash? })`);
  for (const key of Object.keys(value)) {
    if (key !== "url" && key !== "trailingSlash") {
      fail(`option "externalPreview.${key}" is not supported (expected url, trailingSlash)`);
    }
  }
  const rawUrl = value.url;
  if (typeof rawUrl !== "string" || rawUrl === "") fail(`option "externalPreview.url" must be a non-empty string`);
  if (!isRootAbsoluteUrl(rawUrl)) {
    fail(`option "externalPreview.url" = "${rawUrl}" must be a root-absolute path starting with a single "/" (no scheme, no "//")`);
  }
  const trailingSlash = value.trailingSlash;
  if (trailingSlash !== undefined && trailingSlash !== "never" && trailingSlash !== "always") {
    fail(`option "externalPreview.trailingSlash" must be "never" or "always"`);
  }
  let url = rawUrl;
  if (trailingSlash === "never") url = url.length > 1 ? url.replace(/\/+$/, "") : url;
  if (trailingSlash === "always" && !url.endsWith("/")) url = `${url}/`;
  return { url };
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

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function hostPathValue(name: string, value: unknown): string | null | undefined {
  if (isPresent(value) && typeof value !== "string") fail(`option "${name}" must be a string (project-root-relative path)`);
  return value as string | null | undefined;
}

function resolveRegistrySource(projectRoot: string, options: Record<string, unknown>): ResolvedRegistrySource {
  const mode = options.registryMode ?? "module";
  if (mode !== "module" && mode !== "descriptor") {
    fail(`option "registryMode" must be "module" or "descriptor" (got ${JSON.stringify(mode)})`);
  }
  if (mode === "module") {
    if (isPresent(options.descriptorModule)) {
      fail(`option "descriptorModule" is only valid with registryMode: "descriptor" (registryMode is "module")`);
    }
    const registryModule = resolveHostModule(projectRoot, "registryModule", hostPathValue("registryModule", options.registryModule), {
      required: true,
      example: "./src/styleguide/sg-registry.ts",
    });
    return { mode, registryModule };
  }
  if (isPresent(options.registryModule)) {
    fail(`option "registryModule" is only valid with registryMode: "module" (registryMode is "descriptor")`);
  }
  if (Array.isArray(options.componentDocs) && options.componentDocs.length > 0) {
    fail(`option "componentDocs" is only valid with registryMode: "module" (descriptor stories have no registry key to match)`);
  }
  const descriptorModule = resolveHostModule(projectRoot, "descriptorModule", hostPathValue("descriptorModule", options.descriptorModule), {
    required: true,
    example: "./src/styleguide/story-descriptors.ts",
    insideRoot: true,
  });
  return { mode, descriptorModule };
}

/** Validates the options block and resolves the registry source; throws `[zudo-sg] …` on invalid input. */
export function resolveRoutesPluginOptions(
  projectRoot: string,
  options: Record<string, unknown>,
): ResolvedRoutesPluginOptions {
  for (const key of Object.keys(options)) {
    if (!OPTION_KEYS.has(key)) {
      fail(`unknown option "${key}" for ${PLUGIN_NAME} (expected one of ${[...OPTION_KEYS].join(", ")})`);
    }
  }
  const registry = resolveRegistrySource(projectRoot, options);
  const previewCssUrl = optionalString("previewCssUrl", options.previewCssUrl);
  const tokensValue = options.tokensManifestModule;
  if (tokensValue !== undefined && tokensValue !== null && typeof tokensValue !== "string") {
    fail(`option "tokensManifestModule" must be a string (project-root-relative path)`);
  }
  const tokensManifestModule = resolveHostModule(projectRoot, "tokensManifestModule", tokensValue, {
    example: "./src/config/ui-design-tokens-manifest.ts",
  });

  const rawRoutes = isPlainObject(options.routes) ? options.routes : {};
  const { routes, disabledRoutes: explicitlyDisabledRoutes } = normalizeRoutes(options.routes);
  const disabledRoutes = new Set(explicitlyDisabledRoutes);
  const externalPreview = normalizeExternalPreview(options.externalPreview);

  if (externalPreview) {
    if (typeof rawRoutes.componentsPreview === "string") {
      fail(
        `option "routes.componentsPreview" cannot be set together with "externalPreview" — ` +
          `externalPreview replaces the in-engine preview route`,
      );
    }
    disabledRoutes.add("componentsPreview");
  }

  if (registry.mode === "descriptor" && !externalPreview) {
    fail(`descriptor mode has no in-engine preview; set externalPreview`);
  }

  // Narrowing of pgen E2, descriptor mode only (epic #879 delegated decision 2):
  // an explicit `routes.tokens` (string or `false`) always wins over this —
  // `"tokens" in rawRoutes` covers both, since `normalizeRoutes` already
  // recorded an explicit `false` in `disabledRoutes`.
  if (
    !("tokens" in rawRoutes) &&
    !isTokensRouteEnabled({ registryMode: registry.mode, tokensRouteOption: undefined, hasTokensManifest: Boolean(tokensManifestModule) })
  ) {
    disabledRoutes.add("tokens");
  }

  return {
    registry,
    routes,
    disabledRoutes: [...disabledRoutes],
    externalPreviewUrl: externalPreview?.url ?? null,
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
    registryMode: resolved.registry.mode,
    categoryOrder: resolved.categoryOrder,
    uiPackageName: resolved.uiPackageName,
    previewCssUrl: resolved.previewCssUrl,
    catalog: resolved.catalog,
    componentDocs: resolved.componentDocs,
    disabledRoutes: resolved.disabledRoutes,
    externalPreviewUrl: resolved.externalPreviewUrl,
  };
}

export function buildContextModuleSource(context: SgContext): string {
  return `export const sgContext = ${JSON.stringify(context)};\n`;
}

/**
 * `virtual:zudo-sg-registry` exports the same three names in every mode, because
 * the one fixed `routes-src/` tree (and the preview island) imports all of them.
 * Descriptor mode imports no StoryModule: only the host descriptor module.
 */
export function buildRegistryModuleSource(source: ResolvedRegistrySource): string {
  if (source.mode === "module") {
    return (
      `export { storyModules, storyExportOrder } from ${JSON.stringify(toForwardSlash(source.registryModule))};\n` +
      "export const storyDescriptors = [];\n"
    );
  }
  return (
    `import * as descriptorModule from ${JSON.stringify(toForwardSlash(source.descriptorModule))};\n` +
    "export const storyModules = {};\n" +
    "export const storyExportOrder = {};\n" +
    'export const storyDescriptors = "storyDescriptors" in descriptorModule ? descriptorModule.storyDescriptors : descriptorModule.default;\n'
  );
}

export function buildTokensModuleSource(tokensManifestModule: string | null): string {
  if (tokensManifestModule === null) return "export const tokensManifest = null;\n";
  const fields = Object.entries(TOKENS_MANIFEST_EXPORTS).map(([field, name]) => `${field}: manifest.${name}`);
  return (
    `import * as manifest from ${JSON.stringify(toForwardSlash(tokensManifestModule))};\n` +
    `export const tokensManifest = { ${fields.join(", ")}, groups: "UI_TOKEN_GROUPS" in manifest ? manifest.UI_TOKEN_GROUPS : undefined };\n`
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

/**
 * Pairs every ENABLED route pattern with its `routes-src/` entrypoint under
 * `packageRoot`. `disabledRoutes` keys get no entry — no `injectRoute()` call,
 * and their entrypoint file is not required to exist.
 */
export function deriveRouteInjections(
  routes: SgRoutes,
  packageRoot: string,
  disabledRoutes: ReadonlyArray<keyof SgRoutes> = [],
): RouteInjection[] {
  const routesSrc = toForwardSlash(join(packageRoot, "routes-src"));
  const disabled = new Set(disabledRoutes);
  return ROUTE_KEYS.filter((key) => !disabled.has(key)).map((key) => ({
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

      const injections = deriveRouteInjections(resolved.routes, packageRoot(), resolved.disabledRoutes);
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
      ctx.addVirtualModule(REGISTRY_MODULE_ID, () => buildRegistryModuleSource(resolved.registry));
      ctx.addVirtualModule(TOKENS_MODULE_ID, () => buildTokensModuleSource(resolved.tokensManifestModule));

      for (const { pattern, entrypoint } of injections) {
        ctx.injectRoute(pattern, entrypoint);
      }
    },
  };
}

export default createRoutesPlugin();
