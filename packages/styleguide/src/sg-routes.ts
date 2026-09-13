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

/** Fills unset route patterns with the defaults. */
export function resolveSgRoutes(routes: Partial<SgRoutes> = {}): SgRoutes {
  return { ...DEFAULT_SG_ROUTES, ...routes };
}

/** Substitutes `[slug]` in `routes.componentsSlug` (`"/components/[slug]"` + `"button"` → `"/components/button"`). */
export function componentHref(routes: Pick<SgRoutes, "componentsSlug">, slug: string): string {
  return routes.componentsSlug.replace("[slug]", slug);
}
