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

/**
 * The story slug occupied by the preview endpoint, if that endpoint falls
 * inside the detail route pattern. Paths with and without a trailing slash
 * name the same static page. An outside-namespace preview reserves nothing.
 */
export function previewCollisionSlug(routes: Partial<SgRoutes> = {}): string | null {
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
