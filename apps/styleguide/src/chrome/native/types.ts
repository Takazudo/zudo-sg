// Vendored types for the native sidebar tree.
//
// These are copied verbatim from zudo-doc's host source (the `NavNode`
// interface and `LocaleLink` type) so the styleguide can render the same
// interactive tree component without depending on host-only modules. The
// shapes must stay structurally identical to what `SidebarTree` consumes.

/**
 * A node in the sidebar navigation tree. A category parent has `hasPage:false`
 * and a non-empty `children`; a leaf doc/story has `hasPage:true` and an
 * `href`. `slug` is the stable identity used for active-item matching and the
 * sessionStorage open-set.
 */
export interface NavNode {
  slug: string;
  label: string;
  description?: string;
  position: number;
  href?: string;
  hasPage: boolean;
  children: NavNode[];
  sortOrder?: "asc" | "desc";
  collapsed?: boolean;
}

/**
 * A locale switcher link, consumed by the sidebar footer. The styleguide is
 * single-locale, so this is present only to satisfy the vendored component's
 * prop shape — it is never populated here.
 */
export interface LocaleLink {
  code: string;
  label: string;
  href: string;
  active: boolean;
}
