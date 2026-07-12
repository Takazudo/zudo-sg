/**
 * Site tree derivation — builds the nav/footer/breadcrumb tree from the
 * content collection instead of hand-maintaining it.
 *
 * Design: walk `getCollection("content")`, group entries by frontmatter
 * `section` (falling back to the slug's first segment), and sort by
 * `navOrder`/`sectionOrder`. Add a page with `section` frontmatter and it
 * shows up in nav/footer automatically — no separate list to keep in sync.
 *
 * `getCollection` is synchronous (ADR-004), so this runs in a single SSR pass.
 *
 * Business "lines" (a second content dimension living under
 * `content/lines/<key>/...` → route `/lines/<key>/...`) are scoped
 * structurally: {@link deriveLineKey} reads the slug prefix only, with no
 * registry lookup. Wave 5 #232 (this file) ships the plumbing; a richer
 * per-line registry (brand labels, accent keys, home hrefs — `config/lines.ts`)
 * is out of scope here and lands in a later wave. Until then, line pages are
 * grouped under their raw key and breadcrumbs show that raw key as the label
 * — callers that need nicer labels can layer a lookup on top of
 * {@link deriveLineKey} without changing this module's contract.
 *
 * This file is the thin `getCollection`-calling half; the pure tree-building
 * logic (no `@takazudo/zfb` import) lives in `site-tree-core.ts` — see that
 * file's module doc for why the split exists (Vitest SSR module loading).
 */
import { getCollection } from "@takazudo/zfb/content";
import { buildContentSchema } from "./content-schema";
import { buildTreeFromEntries, scopeEntries } from "./site-tree-core";
import type { SiteTree, NavSection } from "./site-tree-core";

export { resolveSectionLabel, deriveLineKey } from "./section-label";
export {
  normalizeSlug,
  slugToHref,
  buildTreeFromEntries,
  scopeEntries,
  getBreadcrumbs,
} from "./site-tree-core";
export type { NavLeaf, NavSection, SiteTree, Crumb, TreeEntry } from "./site-tree-core";

/**
 * Reads the site tree from the content collection. Synchronous — safe to
 * call from anywhere during SSR (`getCollection` is sync per ADR-004).
 *
 * @param lineKey When set, scopes the tree to `lines/<lineKey>/...` entries.
 *   Omit for the corporate tree (everything outside `lines/`).
 *
 * Until content exists (#233), this returns an empty section list — no mock
 * fallback. A shell-only build legitimately has nothing to show in nav/footer
 * yet; that's expected, not a bug.
 */
export function getSiteTree(lineKey?: string): SiteTree {
  let sections: NavSection[] = [];
  try {
    const rawEntries = getCollection<Record<string, unknown>>("content");
    // zfb does not runtime-validate the collection schema (v1.1 reserved),
    // so parse explicitly here. A ZodError re-throws (fail the build on bad
    // frontmatter); a missing/empty collection falls through to `[]` below.
    const contentSchema = buildContentSchema();
    const entries = rawEntries.map((e) => ({
      ...e,
      data: contentSchema.parse(e.data),
    }));
    sections = buildTreeFromEntries(scopeEntries(entries, lineKey));
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") throw err;
    sections = [];
  }
  return { sections };
}
