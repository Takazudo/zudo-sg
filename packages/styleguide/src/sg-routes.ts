// Catalog route patterns (ADR docs/adr/styleguide-engine.md decision 6).
// Internal hrefs are built from a `SgRoutes` object + the host's `withBase`,
// never from literals, so the routes plugin can feed `sgContext.routes`.

export interface SgRoutes {
  componentsIndex: string;
  /** Must contain the `[slug]` segment. */
  componentsSlug: string;
  componentsPreview: string;
  tokens: string;
}

export const DEFAULT_SG_ROUTES: Readonly<SgRoutes> = Object.freeze({
  componentsIndex: "/components",
  componentsSlug: "/components/[slug]",
  componentsPreview: "/components/preview",
  tokens: "/tokens",
});

/**
 * Route keys a host may opt out of injecting entirely (`routes.<key>: false`).
 * `componentsIndex` / `componentsSlug` are the engine's point and stay
 * required — see `plugins/routes.ts`'s `normalizeRoutes`.
 */
export const DISABLEABLE_ROUTE_KEYS: ReadonlySet<keyof SgRoutes> = new Set(["componentsPreview", "tokens"]);

/** `routes` option shape: a pattern string, or `false` for the two opt-outable routes. */
export type SgRoutesOption = {
  [K in keyof SgRoutes]?: K extends "componentsPreview" | "tokens" ? string | false : string;
};

/** Fills unset route patterns with the defaults. */
export function resolveSgRoutes(routes: Partial<SgRoutes> = {}): SgRoutes {
  return { ...DEFAULT_SG_ROUTES, ...routes };
}

/** Substitutes `[slug]` in `routes.componentsSlug` (`"/components/[slug]"` + `"button"` → `"/components/button"`). */
export function componentHref(routes: Pick<SgRoutes, "componentsSlug">, slug: string): string {
  return routes.componentsSlug.replace("[slug]", slug);
}

/**
 * The story slug occupied by the preview endpoint, if that endpoint falls
 * inside the detail route pattern. Paths with and without a trailing slash
 * name the same static page. An outside-namespace preview reserves nothing.
 *
 * `disabled: true` (the in-engine preview route is opted out, or replaced by
 * an `externalPreview`) short-circuits to `null`: there is no in-catalog
 * preview page to reserve a slug against.
 */
export function previewCollisionSlug(routes: Partial<SgRoutes> = {}, options?: { disabled?: boolean }): string | null {
  if (options?.disabled) return null;
  const resolved = resolveSgRoutes(routes);
  const pattern = resolved.componentsSlug.replace(/\/+$/, "");
  const preview = resolved.componentsPreview.replace(/\/+$/, "");
  const marker = "[slug]";
  const index = pattern.indexOf(marker);
  if (index < 0 || pattern.indexOf(marker, index + marker.length) >= 0) {
    throw new Error(`[zudo-sg] routes.componentsSlug must contain exactly one "${marker}" placeholder`);
  }
  const prefix = pattern.slice(0, index);
  const suffix = pattern.slice(index + marker.length);
  if (!preview.startsWith(prefix) || !preview.endsWith(suffix)) return null;
  const slug = preview.slice(prefix.length, suffix ? -suffix.length : undefined);
  // slugify() emits only this shape. A captured slash means the preview URL
  // lives in another route namespace, not at a generated detail URL.
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

export interface TokensRouteVisibilityInput {
  registryMode: "module" | "descriptor";
  /** `options.routes.tokens` as given by the host: a pattern, `false`, or absent. */
  tokensRouteOption: string | false | undefined;
  /** Whether the host configured a token manifest (`zudo-sg.config.mjs` `tokens.manifestOut` / the resolved `tokensManifestModule`). */
  hasTokensManifest: boolean;
}

/**
 * Whether the `/tokens` route should be injected and linked from chrome.
 * Shared by `config/index.ts` (`withStyleguideChromeDefaults`'s nav item) and
 * `plugins/routes.ts` (route injection / `disabledRoutes`), so the two
 * cannot disagree about it (issue #884 do-item 4).
 *
 * An explicit `routes.tokens` (string or `false`) always wins. Absent that,
 * descriptor mode with no token manifest implies the route off — a narrowing
 * of pgen E2 scoped to descriptor mode only, so module-mode hosts are
 * unaffected (epic #879 delegated decision 2).
 */
export function isTokensRouteEnabled({ registryMode, tokensRouteOption, hasTokensManifest }: TokensRouteVisibilityInput): boolean {
  if (tokensRouteOption === false) return false;
  if (typeof tokensRouteOption === "string") return true;
  if (registryMode === "descriptor" && !hasTokensManifest) return false;
  return true;
}
