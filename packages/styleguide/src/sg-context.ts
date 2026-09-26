// `sgContext` — the data-only payload of `virtual:zudo-sg-context` (ADR
// docs/adr/styleguide-engine.md decision 10). Emitted as JSON by
// `@takazudo/zudo-sg/plugins/routes`; nothing callable may ride it.

import type { ComponentDocsRoot } from "./registry/component-docs.js";
import type { SgRoutes } from "./sg-routes.js";

/** Default URL of the standalone-compiled preview stylesheet (ADR decision 4). */
export const DEFAULT_PREVIEW_CSS_URL = "/_zudo-sg/preview.css";

/** Default catalog landing heading. */
export const DEFAULT_CATALOG_TITLE = "Component catalog";

export interface SgCatalogText {
  title: string;
  /** Host intro paragraph; `null` lets the catalog route render its built-in intro. */
  intro: string | null;
}

/**
 * Where the catalog's stories come from. `"module"`: the generated StoryModule
 * registry (`registryModule`). `"descriptor"`: host-supplied plain-data
 * `StoryDescriptor`s (`descriptorModule`) — no render functions reach the engine.
 */
export type SgRegistryMode = "module" | "descriptor";

export interface SgContext {
  /** zfb `config.base` (`"/"` when unset). */
  base: string;
  routes: SgRoutes;
  registryMode: SgRegistryMode;
  categoryOrder: string[];
  /** Package name shown in code-panel import snippets; `null` when the host did not set one. */
  uiPackageName: string | null;
  /** Root-absolute preview stylesheet URL, before the base prefix. */
  previewCssUrl: string;
  catalog: SgCatalogText;
  /** One entry per components root: its registry key prefix + MDX docs collection (`[]` = no docs). */
  componentDocs: ComponentDocsRoot[];
  /**
   * Route keys with no injected `injectRoute()` call (`routes.<key>: false`,
   * or implied — `componentsPreview` when `externalPreview` is set, `tokens`
   * in descriptor mode with no token manifest). Kept separate from `routes`
   * (which stays all-strings) rather than widening `SgRoutes` to `string | false`.
   */
  disabledRoutes: Array<keyof SgRoutes>;
  /**
   * Root-absolute host document URL (before the base prefix) that replaces
   * the in-engine preview route, or `null` when none is configured. The
   * detail route passes `withBase(externalPreviewUrl ?? routes.componentsPreview)`
   * as `previewUrl` to `DetailWorkbench` and the code panel.
   */
  externalPreviewUrl: string | null;
  /**
   * Whether `zdtpApplyProxy.tabsModule` is configured (issue #872's
   * `isPreviewTokenPanelWired()` verdict, `sg-routes.ts`). Gates the `/tokens`
   * "Preview tokens" button and the detail route's `DetailWorkbench`
   * `toolbar.tokenPanel` flag — an unwired host renders neither, instead of a
   * dead control that dispatches to nothing.
   */
  previewTokenPanel: boolean;
}
