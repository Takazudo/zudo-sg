// `sgContext` — the data-only payload of `virtual:zudo-sg-context` (ADR
// docs/adr/styleguide-engine.md decision 10). Emitted as JSON by
// `@takazudo/zudo-sg/plugins/routes`; nothing callable may ride it.

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

export interface SgContext {
  /** zfb `config.base` (`"/"` when unset). */
  base: string;
  routes: SgRoutes;
  categoryOrder: string[];
  /** Package name shown in code-panel import snippets; `null` when the host did not set one. */
  uiPackageName: string | null;
  /** Root-absolute preview stylesheet URL, before the base prefix. */
  previewCssUrl: string;
  catalog: SgCatalogText;
}
