// Canonical root-slug rule (zudolab/zudo-doc#1891, closes #1873).
//
// A doc collection's bare root `index.mdx` must resolve to the canonical
// URL `/docs/` — i.e. an EMPTY route slug `""` — NOT `/docs/index/`.
// Five independent index-stripping sites historically disagreed on what a
// bare root `index` becomes; this helper is the single source of truth they
// all route through.
//
// Rule:
//   - bare root  "index"      → ""   (URL /docs/)
//   - nested     "x/index"    → "x"  (URL /docs/x/)
//   - everything else         → unchanged
export function toRouteSlug(id: string): string {
  if (id === "index") return "";
  return id.replace(/\/index$/, "");
}

// Convert a canonical route slug into the `params.slug` array zfb's
// optional-catchall route (`[[...slug]]`) expects. The bare root ("") maps to
// `[]` (zero segments → /docs/); a naive `"".split("/")` yields `[""]`, which
// zfb's catchall router REJECTS (empty array element), silently dropping the
// entire route. Every `.split("/")` at a docs route's paths() site must go
// through this helper.
export function toSlugParams(routeSlug: string): string[] {
  return routeSlug === "" ? [] : routeSlug.split("/");
}

export function toTitleCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
