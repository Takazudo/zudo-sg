// Builds the styleguide sidebar tree as `NavNode[]` from a registry. Build it
// ONCE per site and share the array between the desktop tree and the mobile
// drawer — it is the single source of truth for the nav tree.
//
// Shape (matches zudo-doc's native tree NavNode contract):
//   • one leading leaf — "Overview" → the components index route;
//   • one parent per category (hasPage:false, no href) holding its stories;
//   • one leaf per story (href = withBase(componentHref(routes, slug))).
// `position` is a monotonically increasing ordering hint; array order is
// authoritative (the registry already sorts categories and stories).

import { componentHref, resolveSgRoutes, type SgRoutes } from "../sg-routes.js";
import { OVERVIEW_SLUG, type Registry } from "./registry.js";

/** Structural copy of zudo-doc's sidebar `NavNode`. */
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

export interface BuildNavNodesOptions {
  /** The host's base-path helper (e.g. zudo-doc's `withBase`). */
  withBase: (path: string) => string;
  routes?: Partial<SgRoutes>;
  /** Label of the leading index leaf. Default `"Overview"`. */
  overviewLabel?: string;
}

export function buildNavNodes(
  registry: Pick<Registry, "getCategoryGroups">,
  options: BuildNavNodesOptions,
): NavNode[] {
  const { withBase } = options;
  const routes = resolveSgRoutes(options.routes);
  let position = 0;
  const next = () => position++;

  const overview: NavNode = {
    slug: OVERVIEW_SLUG,
    label: options.overviewLabel ?? "Overview",
    position: next(),
    href: withBase(routes.componentsIndex),
    hasPage: true,
    children: [],
  };

  const categoryNodes: NavNode[] = registry.getCategoryGroups().map((group) => ({
    // Category parents have no page; the prefixed slug is a stable identity
    // for open-set / active-subtree logic that cannot collide with a story slug.
    slug: `category:${group.category}`,
    label: group.category,
    position: next(),
    hasPage: false,
    children: group.stories.map((story) => ({
      slug: story.slug,
      label: story.meta.title,
      position: next(),
      href: withBase(componentHref(routes, story.slug)),
      hasPage: true,
      children: [],
    })),
  }));

  return [overview, ...categoryNodes];
}
