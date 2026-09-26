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
import { isPreviewTokenPanelWired, isTokensRouteEnabled, resolveSgRoutes, type SgRoutes, type SgRoutesOption } from "../sg-routes.js";
import type { HostTokensSpec } from "../token-spec.js";
import { PREVIEW_TOKEN_PANEL_CAPTURE_SCRIPT } from "../token-tweak/preview-token-panel-capture.js";
export type { HostTokensSpec, HostTokenGroupSpec, HostTokenSpec, TokenPreview, TokenControl, GeneratedTokenGroups, GeneratedTokenGroup } from "../token-spec.js";

export const ROUTES_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/routes";
export const PREVIEW_CSS_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/preview-css";
export const ZDTP_APPLY_PROXY_PLUGIN_NAME = "@takazudo/zudo-sg/plugins/zdtp-apply-proxy";
const ZUDO_DOC_ROUTES_PLUGIN_NAME = "@takazudo/zudo-doc/plugins/routes";

// Inlined copy of zudo-doc's `AFTER_NAVIGATE_EVENT` (@takazudo/zudo-doc/transitions).
// This module must stay importable without the peer installed — `check-pack.sh`
// imports every `exports` subpath from a scratch project holding only the tarball —
// so the value is duplicated here and pinned to the peer's export by
// `__tests__/config.test.ts`.
const AFTER_NAVIGATE_EVENT = "zfb:after-swap";

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

/** Module mode (default): stories come from the generated StoryModule registry (`registryOut`). */
export interface ZudoSgModuleRegistry {
  mode: "module";
}

/**
 * Descriptor mode: stories come from plain-data `StoryDescriptor`s exported by
 * `module` (project-root-relative, inside the project) as the named export
 * `storyDescriptors`, or as the default export when that name is absent.
 */
export interface ZudoSgDescriptorRegistry {
  mode: "descriptor";
  module: string;
}

export type ZudoSgRegistryOption = ZudoSgModuleRegistry | ZudoSgDescriptorRegistry;

interface ZudoSgModuleSourceOptions {
  registry?: ZudoSgModuleRegistry;
  /** Story corpora; one `componentDocs*` collection is registered per `dir`. */
  componentsRoots: ReadonlyArray<{ dir: string; importBase?: string }>;
  /** Project-root-relative generated registry (the routes plugin's `registryModule`). */
  registryOut: string;
}

interface ZudoSgDescriptorSourceOptions {
  registry: ZudoSgDescriptorRegistry;
  /** Ignored by the engine in descriptor mode (no component-doc collections); CLI-only. */
  componentsRoots?: ReadonlyArray<{ dir: string; importBase?: string }>;
  /** Ignored by the engine in descriptor mode; CLI-only. */
  registryOut?: string;
}

export type ZudoSgComposeOptions = ZudoSgComposeBaseOptions & (ZudoSgModuleSourceOptions | ZudoSgDescriptorSourceOptions);

export interface ZudoSgComposeBaseOptions {
  categoryOrder?: string[];
  uiPackageName?: string;
  /** Project-root-relative preview stylesheet entry (the preview-css plugin's input). */
  previewStyles: string;
  /** Default `/_zudo-sg/preview.css`. */
  previewCssUrl?: string;
  routes?: SgRoutesOption;
  /**
   * A host-served preview document that replaces the in-engine
   * `componentsPreview` route (implied disabled once this is set). `url` must
   * be root-absolute; `previewStyles`'s compiled CSS and the code panel both
   * still apply — only the document that hosts the preview iframe moves.
   * Required in descriptor mode (descriptors carry no render functions).
   * Forwarded verbatim to the routes plugin's `externalPreview` option, which
   * validates and normalizes it.
   */
  externalPreview?: { url: string; trailingSlash?: "never" | "always" };
  catalog?: { title?: string; intro?: string };
  /**
   * Populate an otherwise empty zudo-doc header with links to the engine-owned
   * Components and Design Tokens routes, plus search. Defaults to true.
   * Existing host navigation remains authoritative and is never replaced.
   */
  chromeDefaults?: boolean;
  /** `tokens.manifestOut` feeds the `/tokens` route's dashboards (routes plugin `tokensManifestModule`). */
  tokens?: { manifestOut?: string; cssFiles?: readonly string[]; spec?: HostTokensSpec };
  /**
   * `@takazudo/zudo-sg/plugins/zdtp-apply-proxy` options
   * (`{ routingFile, writeRoot, tabsModule? }`). Omitted → the plugin is still
   * listed (the engine's preview token panel island imports its virtual
   * module) but runs disabled: no tabs, no Apply endpoint. `routingFile` and
   * `writeRoot` are optional TOGETHER — `{ tabsModule }` alone is valid (tabs
   * without the dev-only Apply write sandbox); exactly one of the two is not.
   */
  zdtpApplyProxy?:
    | { routingFile: string; writeRoot: string; tabsModule?: string }
    | { routingFile?: undefined; writeRoot?: undefined; tabsModule?: string };
  /**
   * Append the engine's header trigger for the preview token panel to the
   * zudo-doc routes plugin's `headerRightItems`. Defaults to whether the panel
   * is wired at all (`isPreviewTokenPanelWired(zdtpApplyProxy)`, issue #872) —
   * `true` when `zdtpApplyProxy.tabsModule` is set, `false` otherwise, so an
   * unwired host no longer ships a dead button by default. Unlike
   * `chromeDefaults` this is unconditional: a host with its own `headerNav`
   * still gets the trigger. An explicit `true` always injects the trigger,
   * even when unwired — `withZudoSg` then emits a one-time `console.warn`
   * naming `zdtpApplyProxy.tabsModule`, since the button would otherwise be
   * dead with no signal. An explicit `false` always stays off.
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

function withStyleguideChromeDefaults(plugin: unknown, routes: SgRoutes, tokensEnabled: boolean): unknown {
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

  // `tokensEnabled` is the same `isTokensRouteEnabled()` verdict the routes
  // plugin uses to decide whether `/tokens` is injected at all (do-item 4) —
  // a disabled route gets no nav link and no localization prefix for it.
  const navGlobalPaths = tokensEnabled ? [routes.componentsIndex, routes.tokens] : [routes.componentsIndex];

  return {
    ...plugin,
    options: {
      ...options,
      settings: {
        ...settings,
        headerNav: tokensEnabled
          ? [
              { label: "Components", path: routes.componentsIndex, categoryMatch: "components", versioned: false },
              { label: "Design Tokens", path: routes.tokens, versioned: false },
            ]
          : [{ label: "Components", path: routes.componentsIndex, categoryMatch: "components", versioned: false }],
        // Engine navigation targets global routes, including from translated docs.
        defaultLocaleOnlyPrefixes: [...new Set([
          ...(Array.isArray(settings.defaultLocaleOnlyPrefixes) ? settings.defaultLocaleOnlyPrefixes : []),
          ...navGlobalPaths.map((path) => `${path.replace(/\/+$/, "")}/`),
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
  PREVIEW_TOKEN_PANEL_CAPTURE_SCRIPT +
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
 * The header-right item `withZudoSg()` appends to the zudo-doc routes plugin.
 *
 * Exported because a host that renders its OWN `<header>` (a host-owned
 * `pages/index.tsx` calling `HeaderWithDefaults` with `settings.headerRightItems`)
 * must add this item to those settings itself. zfb's client router PERSISTS the
 * `<header>` node across a swap — the live header replaces the incoming one — so
 * a session that starts on a trigger-less host page keeps that header for every
 * subsequent SPA navigation, and the trigger never appears on the engine routes.
 * `withZudoSg()` detects an item already carrying the button id and does not
 * append a second one.
 */
export const HEADER_TOKEN_TRIGGER_ITEM: { type: "html"; html: string } = {
  type: "html",
  html: HEADER_TOKEN_TRIGGER_HTML,
};

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
        headerRightItems: [...headerRightItems, HEADER_TOKEN_TRIGGER_ITEM],
      },
    },
  };
}

let warnedUnwiredHeaderTrigger = false;

/** Test seam: re-arms the one-shot "trigger forced on while unwired" warning (issue #872). */
export function __resetHeaderTokenTriggerWarningForTests(): void {
  warnedUnwiredHeaderTrigger = false;
}

/** Validates `options.registry`; returns the descriptor module path in descriptor mode, else `null`. */
function descriptorModuleOf(registry: unknown): string | null {
  if (registry === undefined) return null;
  if (!isRecord(registry)) {
    throw new Error('[zudo-sg] option "registry" must be { mode: "module" } or { mode: "descriptor", module }');
  }
  for (const key of Object.keys(registry)) {
    if (key !== "mode" && key !== "module") {
      throw new Error(`[zudo-sg] option "registry.${key}" is not supported (expected mode, module)`);
    }
  }
  if (registry.mode === "module") {
    if (registry.module !== undefined) {
      throw new Error('[zudo-sg] option "registry.module" is only valid with registry.mode "descriptor"');
    }
    return null;
  }
  if (registry.mode === "descriptor") {
    if (typeof registry.module !== "string" || registry.module === "") {
      throw new Error(
        '[zudo-sg] option "registry.module" is required with registry.mode "descriptor" ' +
          '(project-root-relative path, e.g. "./src/styleguide/story-descriptors.ts")',
      );
    }
    return registry.module;
  }
  throw new Error(`[zudo-sg] option "registry.mode" must be "module" or "descriptor" (got ${JSON.stringify(registry.mode)})`);
}

/** Strips the `false` opt-out values `SgRoutesOption` allows, for callers (`resolveSgRoutes`) that need plain patterns. */
function stringRoutesOnly(routes: SgRoutesOption | undefined): Partial<SgRoutes> {
  const out: Partial<SgRoutes> = {};
  if (!routes) return out;
  for (const [key, value] of Object.entries(routes)) {
    if (typeof value === "string") out[key as keyof SgRoutes] = value;
  }
  return out;
}

/** Returns the engine's zfb plugin descriptors and content collections. */
export function zudoSg(options: ZudoSgComposeOptions): ZudoSgFragment {
  if (!options || typeof options !== "object") {
    throw new Error("[zudo-sg] zudoSg(options) requires an options object (the zudo-sg.config.mjs shape)");
  }
  const descriptorModule = descriptorModuleOf(options.registry);
  // Descriptor mode registers no component-doc collections: descriptors carry no registry key to pair with.
  const roots = descriptorModule === null && Array.isArray(options.componentsRoots) ? options.componentsRoots : [];
  const previewCssUrl = options.previewCssUrl ?? DEFAULT_PREVIEW_CSS_URL;
  const registrySource =
    descriptorModule === null
      ? {
          registryModule: options.registryOut,
          // Pairs each root's registry key prefix with its collection below, so the
          // detail route resolves a story's doc from the root its key belongs to.
          componentDocs: componentDocsRoots(roots),
        }
      : { registryMode: "descriptor", descriptorModule };

  const plugins: ZudoSgPluginDescriptor[] = [
    {
      name: ROUTES_PLUGIN_NAME,
      options: definedOnly({
        ...registrySource,
        routes: options.routes,
        externalPreview: options.externalPreview,
        categoryOrder: options.categoryOrder,
        uiPackageName: options.uiPackageName,
        previewCssUrl,
        catalog: options.catalog,
        tokensManifestModule: options.tokens?.manifestOut,
        previewTokenPanel: isPreviewTokenPanelWired(options.zdtpApplyProxy),
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
  const registryMode = descriptorModuleOf(options.registry) === null ? "module" : "descriptor";
  const tokensEnabled = isTokensRouteEnabled({
    registryMode,
    tokensRouteOption: options.routes?.tokens,
    hasTokensManifest: options.tokens?.manifestOut !== undefined,
  });
  const pluginsWithChrome =
    options.chromeDefaults === false
      ? presetPlugins
      : presetPlugins.map((plugin) => withStyleguideChromeDefaults(plugin, resolveSgRoutes(stringRoutesOnly(options.routes)), tokensEnabled));
  // Default follows whether the panel is wired at all (issue #872): a host
  // that never set `zdtpApplyProxy.tabsModule` no longer ships a dead button.
  // An explicit `true` still forces the trigger on but warns once, since the
  // button would otherwise be dead with nothing to say so.
  const previewTokenPanelWired = isPreviewTokenPanelWired(options.zdtpApplyProxy);
  const triggerEnabled = options.headerTokenTrigger ?? previewTokenPanelWired;
  if (options.headerTokenTrigger === true && !previewTokenPanelWired && !warnedUnwiredHeaderTrigger) {
    warnedUnwiredHeaderTrigger = true;
    console.warn(
      '[zudo-sg] headerTokenTrigger is explicitly enabled but "zdtpApplyProxy.tabsModule" is not configured — ' +
        "the header trigger will render as a dead control until tabsModule is set (issue #872)",
    );
  }
  // Runs AFTER the chrome pass so the trigger trails the `search` item that
  // pass may have appended.
  const pluginsWithTrigger = triggerEnabled ? pluginsWithChrome.map(withHeaderTokenTrigger) : pluginsWithChrome;
  return {
    ...presetFragment,
    plugins: [...pluginsWithTrigger, ...sg.plugins],
    collections: [...(presetFragment.collections ?? []), ...sg.collections],
  };
}
