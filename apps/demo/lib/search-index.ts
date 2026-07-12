/**
 * Search index — reads the content collection and builds the cross-site
 * search index `pages/search.tsx` embeds as JSON.
 *
 * Design: walk `getCollection("content")` (synchronous, ADR-004) the same
 * way `lib/site-tree.ts` does for nav/footer, but hand every entry to
 * `search-index-core.ts`'s pure `buildSearchIndex` — see that file's module
 * doc for why the zfb-calling half and the pure half are split.
 */
import { getCollection } from "@takazudo/zfb/content";
import type { SearchDoc } from "@zudo-sg/ui/src/search/search-doc.ts";
import { buildContentSchema } from "./content-schema";
import { buildSearchIndex } from "./search-index-core";

/**
 * Reads the search index from the content collection. Synchronous — safe to
 * call from anywhere during SSR (`getCollection` is sync per ADR-004).
 *
 * As with `getSiteTree`, frontmatter is parsed explicitly (zfb does not
 * runtime-validate a collection's `schema` today). A ZodError re-throws
 * (fail the build on bad frontmatter); a missing/empty collection falls
 * through to `[]` — until content exists (#233), an empty index is
 * expected, not a bug.
 */
export function getSearchIndex(): SearchDoc[] {
  try {
    const rawEntries = getCollection<Record<string, unknown>>("content");
    const contentSchema = buildContentSchema();
    const entries = rawEntries.map((e) => ({
      slug: e.slug,
      data: contentSchema.parse(e.data),
      body: e.body,
    }));
    return buildSearchIndex(entries);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") throw err;
    return [];
  }
}
