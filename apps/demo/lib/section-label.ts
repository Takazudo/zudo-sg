/**
 * resolveSectionLabel — single source for "which section does this slug
 * belong to" (used by cross-content search once it lands, and re-exported
 * from site-tree.ts so callers only need one import path).
 *
 * Split out from site-tree.ts so it has no `@takazudo/zfb` dependency and
 * can be unit-tested directly (see `__tests__/section-label.test.ts`).
 * `deriveLineKey` lives here (not site-tree.ts) so site-tree.ts can import it
 * from this module without a circular import back the other way.
 *
 * Rules:
 *   1. Under `lines/<key>/...`: returns the raw key. #232 (this file) has no
 *      per-line label registry yet — see lib/site-tree.ts's module doc — so
 *      "vacuum" reads as "vacuum", not a branded display name. A later wave
 *      can look the key up in a registry and pass a nicer label through.
 *   2. Corporate scope with `section` frontmatter: returned as-is.
 *   3. Corporate scope without `section`: falls back to the slug's first
 *      segment.
 */

/**
 * Derives the active business-line key from a normalized slug, purely from
 * its `lines/<key>/...` (or bare `lines/<key>`) prefix — no registry lookup.
 * Returns undefined for slugs outside `lines/`.
 */
export function deriveLineKey(normalizedSlug: string | undefined): string | undefined {
  if (!normalizedSlug) return undefined;
  const segs = normalizedSlug.split("/").filter(Boolean);
  if (segs[0] !== "lines") return undefined;
  return segs[1];
}

export function resolveSectionLabel(normalizedSlug: string, section: string | undefined): string {
  const lineKey = deriveLineKey(normalizedSlug);
  if (lineKey) return lineKey;
  if (section) return section;
  const firstSeg = normalizedSlug.split("/").filter(Boolean)[0];
  return firstSeg ?? "";
}
