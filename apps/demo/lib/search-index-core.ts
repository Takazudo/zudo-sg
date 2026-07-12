/**
 * Search index derivation — the zfb-free half.
 *
 * Split out from search-index.ts so it has no `@takazudo/zfb` import and can
 * be unit-tested directly (see `__tests__/search-index-core.test.ts`) —
 * mirrors the site-tree.ts / site-tree-core.ts split (importing
 * `@takazudo/zfb/content` pulls a `react/jsx-runtime` import Vitest's SSR
 * module loader doesn't alias to `preact/jsx-runtime`; see that file's
 * module doc for the full rationale).
 *
 * Builds the shared `@zudo-sg/ui` `SearchDoc` record (title/href/section/
 * description/excerpt) for every content entry — the cross-site search
 * index embedded as JSON by `pages/search.tsx`. Unlike `getSiteTree`
 * (lib/site-tree.ts), `navHidden` entries are NOT excluded: a standalone
 * article hidden from nav/footer is exactly the kind of easy-to-lose-track-of
 * content cross-site search exists to surface.
 */
import type { SearchDoc } from "@zudo-sg/ui/src/search/search-doc.ts";
import type { ContentData } from "./content-schema";
import { normalizeSlug, slugToHref } from "./site-tree-core";
import { resolveSectionLabel } from "./section-label";

/** Max excerpt length embedded per doc — long enough to show a matched snippet, short enough to keep the embedded JSON index small. */
const EXCERPT_MAX = 160;

/** Builds a naive title fallback from a slug's last segment (title frontmatter absent). */
function fallbackTitle(slug: string): string {
  const last = slug.split("/").filter(Boolean).pop() ?? slug;
  return last.replace(/[-_]/g, " ");
}

/**
 * Strips common markdown syntax down to plain text for a search excerpt.
 * Not a full markdown parser — just enough that a matched snippet reads
 * cleanly: fenced code blocks and images are dropped, links keep their
 * display text, heading/quote/table-rule marks and emphasis punctuation are
 * stripped, and runs of whitespace collapse to one space.
 */
export function toPlainText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\s|:-]+/gm, " ")
    .replace(/[*_`~]/g, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One raw entry to feed into {@link buildSearchIndex}. */
export type SearchIndexEntry = { slug: string; data: ContentData; body: string };

/**
 * Pure index-building function — derives `SearchDoc` records from raw
 * entries. Exposed separately from `getSearchIndex` (search-index.ts) so
 * tests can feed in fixtures without going through `getCollection`.
 *
 * Sorted by title so the query-less initial render (the static build's
 * no-JS baseline) and the SSR snapshot are both deterministic.
 */
export function buildSearchIndex(entries: SearchIndexEntry[]): SearchDoc[] {
  const docs: SearchDoc[] = entries.map((entry) => {
    const slug = normalizeSlug(entry.slug);
    const plain = toPlainText(entry.body ?? "");
    return {
      title: entry.data.title ?? fallbackTitle(slug),
      href: slugToHref(slug),
      section: resolveSectionLabel(slug, entry.data.section),
      description: entry.data.description ?? "",
      excerpt: plain.length > EXCERPT_MAX ? `${plain.slice(0, EXCERPT_MAX)}…` : plain,
    };
  });
  docs.sort((a, b) => a.title.localeCompare(b.title));
  return docs;
}
