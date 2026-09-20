// @takazudo/zudo-sg/config — zfb config composition (ADR
// docs/adr/styleguide-engine.md decision 9).
//
// PURE DATA: no `node:` imports anywhere in this module's graph. zfb evaluates
// `zfb.config.ts` node-free, so everything here returns bare-specifier plugin
// descriptors (never imported plugin functions) and plain collection objects.
// Host paths are validated later, inside each plugin's `setup()` (fail-fast,
// like zudo-doc's preset: a missing host module throws there, not here).

import {
  COMPONENT_DOCS_COLLECTION,
  componentDocsCollectionName,
  componentDocsRoots,
} from "../registry/component-docs.js";
import { DEFAULT_PREVIEW_CSS_URL } from "../sg-context.js";
import { resolveSgRoutes, type SgRoutes } from "../sg-routes.js";

export const ROUTES_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/routes";
export const PREVIEW_CSS_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/preview-css";
export const ZDTP_APPLY_PROXY_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/zdtp-apply-proxy";
const ZUDO_DOC_ROUTES_PLUGIN_NAME = "@takazudo/zudo-doc/plugins/routes";

/** Collection name of `componentsRoots[0]`; later roots append their index. */
export const COMPONENT_DOCS_COLLECTION_BASE = COMPONENT_DOCS_COLLECTION;
export { componentDocsCollectionName };

export interface ZudoSgPluginDescriptor {
  name: string;
  options?: Record<string, unknown>;
}

export interface ZudoSgCollection {
  name: string;
  path: string;
  include: string[];
}

export interface ZudoSgComposeOptions {
  /** Story corpora; one `componentDocs*` collection is registered per `dir`. */
  componentsRoots: ReadonlyArray<{ dir: string; importBase?: string }>;
  /** Project-root-relative generated registry (the routes plugin's `registryModule`). */
  registryOut: string;
  categoryOrder?: string[];
  uiPackageName?: string;
  /** Project-root-relative preview stylesheet entry (the preview-css plugin's input). */
  previewStyles: string;
  /** Default `/_zudo-sg/preview.css`. */
  previewCssUrl?: string;
  routes?: Partial<SgRoutes>;
  catalog?: { title?: string; intro?: string };
  /**
   * Populate an otherwise empty zudo-doc header with links to the engine-owned
   * Components and Design Tokens routes, plus search. Defaults to true.
   * Existing host navigation remains authoritative and is never replaced.
   */
  chromeDefaults?: boolean;
  /** `tokens.manifestOut` feeds the `/tokens` route's dashboards (routes plugin `tokensManifestModule`). */
  tokens?: { manifestOut?: string; cssFiles?: readonly string[] };
  /**
   * `@takazudo/zudo-sg/plugins/zdtp-apply-proxy` options
   * (`{ routingFile, writeRoot, tabsModule? }`). Omitted → the plugin is still
   * listed (the engine's preview token panel island imports its virtual
   * module) but runs disabled: no tabs, no Apply endpoint.
   */
  zdtpApplyProxy?: { routingFile: string; writeRoot: string; tabsModule?: string };
  /** Extra keys of `zudo-sg.config.mjs` (e.g. `barrelIndex`) are CLI-only and ignored here. */
  [key: string]: unknown;
}

export interface ZudoSgFragment {
  plugins: ZudoSgPluginDescriptor[];
  collections: ZudoSgCollection[];
}

function definedOnly(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withStyleguideChromeDefaults(plugin: unknown, routes: SgRoutes): unknown {
  if (!isRecord(plugin) || plugin.name !== ZUDO_DOC_ROUTES_PLUGIN_NAME) return plugin;

  const options = isRecord(plugin.options) ? plugin.options : {};
  const settings = isRecord(options.settings) ? options.settings : {};
  const headerNav = Array.isArray(settings.headerNav) ? settings.headerNav : [];

  // A non-empty host nav is deliberate project configuration. Only promote
  // engine routes when zudo-doc supplied its minimal empty navigation.
  if (headerNav.length > 0) return plugin;

  const headerRightItems = Array.isArray(settings.headerRightItems) ? settings.headerRightItems : [];
  const hasSearch = headerRightItems.some(
    (item) => isRecord(item) && item.type === "component" && item.component === "search",
  );

  return {
    ...plugin,
    options: {
      ...options,
      settings: {
        ...settings,
        headerNav: [
          { label: "Components", path: routes.componentsIndex, categoryMatch: "components", versioned: false },
          { label: "Design Tokens", path: routes.tokens, versioned: false },
        ],
        // Engine navigation targets global routes, including from translated docs.
        defaultLocaleOnlyPrefixes: [...new Set([
          ...(Array.isArray(settings.defaultLocaleOnlyPrefixes) ? settings.defaultLocaleOnlyPrefixes : []),
          ...[routes.componentsIndex, routes.tokens].map((path) => `${path.replace(/\/+$/, "")}/`),
        ])],
        headerRightItems: hasSearch
          ? headerRightItems
          : [...headerRightItems, { type: "component", component: "search" }],
      },
    },
  };
}

/** Returns the engine's zfb plugin descriptors and content collections. */
export function zudoSg(options: ZudoSgComposeOptions): ZudoSgFragment {
  if (!options || typeof options !== "object") {
    throw new Error("[zudo-sg] zudoSg(options) requires an options object (the zudo-sg.config.mjs shape)");
  }
  const roots = Array.isArray(options.componentsRoots) ? options.componentsRoots : [];
  const previewCssUrl = options.previewCssUrl ?? DEFAULT_PREVIEW_CSS_URL;

  const plugins: ZudoSgPluginDescriptor[] = [
    {
      name: ROUTES_PLUGIN_NAME,
      options: definedOnly({
        registryModule: options.registryOut,
        routes: options.routes,
        categoryOrder: options.categoryOrder,
        uiPackageName: options.uiPackageName,
        previewCssUrl,
        catalog: options.catalog,
        tokensManifestModule: options.tokens?.manifestOut,
        // Pairs each root's registry key prefix with its collection below, so the
        // detail route resolves a story's doc from the root its key belongs to.
        componentDocs: componentDocsRoots(roots),
      }),
    },
    {
      name: PREVIEW_CSS_PLUGIN_NAME,
      options: definedOnly({ previewStyles: options.previewStyles, previewCssUrl }),
    },
    {
      name: ZDTP_APPLY_PROXY_PLUGIN_NAME,
      options: options.zdtpApplyProxy ? definedOnly({ ...options.zdtpApplyProxy }) : {},
    },
  ];

  const collections: ZudoSgCollection[] = roots.map((root, i) => ({
    name: componentDocsCollectionName(i),
    path: root.dir,
    include: ["**/*.mdx"],
  }));

  return { plugins, collections };
}

/**
 * Merges the engine into a zudo-doc preset fragment: engine plugins and
 * collections are appended AFTER the preset's (the routes plugin requires the
 * zudo-doc routes descriptor to be present).
 */
export function withZudoSg<
  P extends { plugins?: ReadonlyArray<unknown>; collections?: ReadonlyArray<unknown> },
>(
  presetFragment: P,
  options: ZudoSgComposeOptions,
): Omit<P, "plugins" | "collections"> & {
  plugins: Array<NonNullable<P["plugins"]>[number] | ZudoSgPluginDescriptor>;
  collections: Array<NonNullable<P["collections"]>[number] | ZudoSgCollection>;
} {
  const sg = zudoSg(options);
  const presetPlugins = [...(presetFragment.plugins ?? [])];
  const pluginsWithChrome =
    options.chromeDefaults === false
      ? presetPlugins
      : presetPlugins.map((plugin) => withStyleguideChromeDefaults(plugin, resolveSgRoutes(options.routes)));
  return {
    ...presetFragment,
    plugins: [...pluginsWithChrome, ...sg.plugins],
    collections: [...(presetFragment.collections ?? []), ...sg.collections],
  };
}
