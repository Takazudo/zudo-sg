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
import type { SgRoutes } from "../sg-routes.js";

export const ROUTES_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/routes";
export const PREVIEW_CSS_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/preview-css";
export const ZDTP_APPLY_PROXY_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/zdtp-apply-proxy";

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
  return {
    ...presetFragment,
    plugins: [...(presetFragment.plugins ?? []), ...sg.plugins],
    collections: [...(presetFragment.collections ?? []), ...sg.collections],
  };
}
