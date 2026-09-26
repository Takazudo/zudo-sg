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
import type { Catalog, CatalogEntry } from "./catalog.js";
import { OVERVIEW_SLUG, type Registry, type StoryEntry } from "./registry.js";

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

/** Anything with the registry's grouping query: a module `Registry` or a mode-neutral `Catalog`. */
export type NavNodesSource = Pick<Registry, "getCategoryGroups"> | Pick<Catalog, "getCategoryGroups">;

function storyLabel(story: StoryEntry | CatalogEntry): string {
  return "meta" in story ? story.meta.title : story.title;
}

export function buildNavNodes(registry: NavNodesSource, options: BuildNavNodesOptions): NavNode[] {
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
    children: group.stories.map((story: StoryEntry | CatalogEntry) => ({
      slug: story.slug,
      label: storyLabel(story),
      position: next(),
      href: withBase(componentHref(routes, story.slug)),
      hasPage: true,
      children: [],
    })),
  }));

  return [overview, ...categoryNodes];
}
