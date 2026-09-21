// @takazudo/zudo-sg/config — zfb config composition (ADR
// docs/adr/styleguide-engine.md decision 9).
//
// PURE DATA: no `node:` imports anywhere in this module's graph. zfb evaluates
// `zfb.config.ts` node-free, so everything here returns bare-specifier plugin
// descriptors (never imported plugin functions) and plain collection objects.
// Host paths are validated later, inside each plugin's `setup()` (fail-fast,
// like zudo-doc's preset: a missing host module throws there, not here).

import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
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
  /**
   * Append the engine's header trigger for the preview token panel to the
   * zudo-doc routes plugin's `headerRightItems`. Defaults to true. Unlike
   * `chromeDefaults` this is unconditional: a host with its own `headerNav`
   * still gets the trigger.
   */
  headerTokenTrigger?: boolean;
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

const HEADER_TOKEN_TRIGGER_ID = "sg-preview-tokens-trigger";
/** Deliberately distinct from the retired doc-chrome channel `toggle-sg-doc-tweak`. */
const PREVIEW_TOKEN_PANEL_EVENT = "toggle-preview-token-panel";
/** Emitted by the engine's route chrome on the four catalog routes. */
const ENGINE_ROUTE_ATTR = "data-sg-engine-route";
const TRIGGER_INSTALLED_FLAG = "__sgPreviewTokensTriggerInstalled";

const SLIDERS_GLYPH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true">' +
  '<line x1="4" y1="6" x2="20" y2="6"></line>' +
  '<line x1="4" y1="12" x2="20" y2="12"></line>' +
  '<line x1="4" y1="18" x2="20" y2="18"></line>' +
  '<circle cx="9" cy="6" r="2.4" fill="currentColor" stroke="none"></circle>' +
  '<circle cx="15" cy="12" r="2.4" fill="currentColor" stroke="none"></circle>' +
  '<circle cx="8" cy="18" r="2.4" fill="currentColor" stroke="none"></circle>' +
  "</svg>";

// The button ships `hidden`; the inline script reveals it only on engine
// routes. An inline <script> cannot import, so the after-navigate event name
// is interpolated from the package constant at config-build time rather than
// hardcoded.
const HEADER_TOKEN_TRIGGER_HTML =
  `<button id="${HEADER_TOKEN_TRIGGER_ID}" type="button" hidden ` +
  'class="flex items-center justify-center text-muted transition-colors hover:text-fg cursor-pointer" ' +
  'aria-label="Open component tokens panel" title="Component tokens" ' +
  `onclick="window.dispatchEvent(new CustomEvent('${PREVIEW_TOKEN_PANEL_EVENT}'))">` +
  SLIDERS_GLYPH +
  "</button>" +
  "<script>(function(){" +
  `if(window.${TRIGGER_INSTALLED_FLAG})return;` +
  `window.${TRIGGER_INSTALLED_FLAG}=true;` +
  "function sync(){" +
  `var btn=document.getElementById(${JSON.stringify(HEADER_TOKEN_TRIGGER_ID)});` +
  "if(!btn)return;" +
  `btn.hidden=!document.querySelector(${JSON.stringify(`[${ENGINE_ROUTE_ATTR}]`)});` +
  "}" +
  "sync();" +
  // The header is parsed before the marker element, so on a hard load the
  // immediate sync() can run too early; re-run once the document is complete.
  'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync);' +
  `document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},sync);` +
  "})();</script>";

/**
 * Appends the preview-token-panel trigger to the zudo-doc header. Unconditional
 * by design: `withStyleguideChromeDefaults` early-returns on a non-empty host
 * `headerNav`, which would hand the trigger to bare scaffolds and withhold it
 * from exactly the configured hosts that need it.
 */
function withHeaderTokenTrigger(plugin: unknown): unknown {
  if (!isRecord(plugin) || plugin.name !== ZUDO_DOC_ROUTES_PLUGIN_NAME) return plugin;

  const options = isRecord(plugin.options) ? plugin.options : {};
  const settings = isRecord(options.settings) ? options.settings : {};
  const headerRightItems = Array.isArray(settings.headerRightItems) ? settings.headerRightItems : [];

  // An `html` header-right item carries no id field, so a second pass over an
  // already-composed fragment can only be detected by substring-matching the
  // button id inside the markup. Do NOT "fix" this to an `item.id` comparison.
  const alreadyInstalled = headerRightItems.some(
    (item) =>
      isRecord(item) &&
      item.type === "html" &&
      typeof item.html === "string" &&
      item.html.includes(HEADER_TOKEN_TRIGGER_ID),
  );
  if (alreadyInstalled) return plugin;

  return {
    ...plugin,
    options: {
      ...options,
      settings: {
        ...settings,
        headerRightItems: [...headerRightItems, { type: "html", html: HEADER_TOKEN_TRIGGER_HTML }],
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
  // Runs AFTER the chrome pass so the trigger trails the `search` item that
  // pass may have appended.
  const pluginsWithTrigger =
    options.headerTokenTrigger === false ? pluginsWithChrome : pluginsWithChrome.map(withHeaderTokenTrigger);
  return {
    ...presetFragment,
    plugins: [...pluginsWithTrigger, ...sg.plugins],
    collections: [...(presetFragment.collections ?? []), ...sg.collections],
  };
}
