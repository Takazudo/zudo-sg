// Builds the styleguide's sidebar navigation tree as a `NavNode[]` ONCE, from
// the story registry. Both the desktop `SidebarTree` island and the mobile
// `SidebarToggle` drawer consume this SAME exported array — do not rebuild it
// in two places (the array is the single source of truth for the nav tree).
//
// Shape (matches the native tree's NavNode contract):
//   • Two leading leaf nodes — "Overview" (/components) and "Design Tokens"
//     (/components/tokens) — so the chrome's primary routes sit at the top.
//   • Each story category becomes a parent node (hasPage:false, no href) whose
//     children are its stories.
//   • Each story becomes a leaf node (hasPage:true, href = withBase('/components/'+slug)).
//
// `position` is a monotonically increasing counter used only as a stable
// ordering hint; the registry already returns categories in CATEGORY_ORDER and
// stories sorted within each category, so the array order is authoritative.

import type { NavNode } from "@/utils/docs";
import { withBase } from "@/utils/base";
import { getCategoryGroups, OVERVIEW_SLUG, TOKENS_SLUG } from "./registry";

/**
 * Build the styleguide nav tree. Pure + synchronous (reads the eager-import
 * registry), so it is safe to call at module scope on any page render.
 */
export function buildNavNodes(): NavNode[] {
  let position = 0;
  const next = () => position++;

  const overview: NavNode = {
    slug: OVERVIEW_SLUG,
    label: "Overview",
    position: next(),
    href: withBase("/components"),
    hasPage: true,
    children: [],
  };

  const tokens: NavNode = {
    slug: TOKENS_SLUG,
    label: "Design Tokens",
    position: next(),
    href: withBase("/components/tokens"),
    hasPage: true,
    children: [],
  };

  const categoryNodes: NavNode[] = getCategoryGroups().map((group) => ({
    // Category parents have no page of their own; the slug just needs to be a
    // stable identity for the open-set / active-subtree logic. Prefix avoids
    // colliding with a story slug.
    slug: `category:${group.category}`,
    label: group.category,
    position: next(),
    hasPage: false,
    children: group.stories.map((story) => ({
      slug: story.slug,
      label: story.meta.title,
      position: next(),
      href: withBase(`/components/${story.slug}`),
      hasPage: true,
      children: [],
    })),
  }));

  return [overview, tokens, ...categoryNodes];
}

/** The styleguide nav tree, built once at module init (eager + synchronous). */
export const navNodes: NavNode[] = buildNavNodes();
