/**
 * Cross-site search (`/search`).
 *
 * A standalone route, independent of the `pages/[...slug].tsx` content
 * catch-all (its `paths()` is content-collection-driven and never emits
 * `/search`, so there's no collision — same as `pages/index.tsx`).
 *
 * This is a fully static build (no SSR adapter — see zfb.config.ts), so
 * there is no per-request `?q=` to read at render time: SSR always renders
 * the full, unfiltered index (`query=""`) as the no-JS baseline, and
 * `SearchResultsEnhancer` reads `?q=` from the URL on mount and re-filters
 * client-side (see its module doc for the SSR/CSR handoff). The header's
 * search box (`SiteHeader`, mounted in every page's chrome) submits a plain
 * GET to `/search?q=...`, which lands here.
 */
import { Island, type IslandProps } from "@takazudo/zfb";
import DefaultLayout from "../layouts/default";
import { Container } from "@zudo-sg/ui/src/shared/container/container.tsx";
import { SearchResults } from "@zudo-sg/ui/src/search/search-results/search-results.tsx";
import SearchResultsEnhancer from "@zudo-sg/ui/src/search/search-results-enhancer/search-results-enhancer.tsx";
import { getSearchIndex } from "../lib/search-index";

// `frontmatter` must be a literal object — zfb statically extracts it from
// the source (no runtime evaluation), so a computed/identifier value here
// silently falls back to SSG defaults instead of erroring.
export const frontmatter = {
  title: "Search",
  description: "Search across the whole demo site — every page, in one place.",
};

export default function SearchPage() {
  // SSR builds the full index (synchronous, ADR-004). See module doc above
  // for why the initial query is always empty on this static build.
  const docs = getSearchIndex();

  return (
    <DefaultLayout title={frontmatter.title} description={frontmatter.description} slug="search">
      <Container as="section" class="py-vsp-xl">
        <h1 class="text-heading font-bold text-fg">Search</h1>
        <p class="mt-vsp-sm text-title text-muted">{frontmatter.description}</p>
        <div class="mt-vsp-lg">
          <SearchResults docs={docs} query="" />
        </div>
      </Container>

      {/* @zudo-sg/ui's SearchResults deliberately does not mount its own
          enhancer (see that component's module doc) — this is the consumer
          wiring it, exactly per its documented example. */}
      <Island when="visible" ssrFallback={null}>
        {(<SearchResultsEnhancer />) as unknown as IslandProps["children"]}
      </Island>
    </DefaultLayout>
  );
}
