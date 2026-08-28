/**
 * SearchResults — cross-site search results list (progressive enhancement).
 *
 * Renders a full, static result list from `docs`/`query` props — no JS
 * required for a correct initial view. `SearchResultsEnhancer` (the sibling
 * island in `../search-results-enhancer/search-results-enhancer`) is what
 * makes `?q=` / the in-page input live-filter without a page reload; it is
 * intentionally NOT mounted from inside this component.
 *
 * This is a plain props-only SSR component — no `@takazudo/zfb` import here,
 * per the package's "no zfb-runtime imports in packages/ui" rule. The
 * consumer wires the enhancer itself:
 *
 * ```tsx
 * import { Island } from "@takazudo/zfb";
 * import { SearchResults } from "@zudo-sg/ui/src/search/search-results/search-results";
 * import SearchResultsEnhancer from "@zudo-sg/ui/src/search/search-results-enhancer/search-results-enhancer";
 *
 * <SearchResults docs={docs} query={query} />
 * <Island when="visible" ssrFallback={null}>
 *   <SearchResultsEnhancer />
 * </Island>
 * ```
 *
 * `ssrFallback={null}` is required — the enhancer renders `null` itself and
 * only attaches behavior in an effect, so evaluating it during SSR is
 * pointless at best and, for a real `<Island>` skip-SSR wrapper, avoids
 * crashing on a missing hydration context. The enhancer finds its target via
 * `document.querySelector("[data-search-root]")`, so it does not need to be a
 * DOM descendant of `<SearchResults>` — anywhere on the same page works.
 *
 * DOM hooks the enhancer relies on (a separate namespace from any host's own
 * nav/header `data-*` hooks):
 *   - `[data-search-root]`  … this component's outer wrapper.
 *   - `[data-search-index]` … `<script type="application/json">` holding `docs`.
 *   - `[data-search-input]` … the search box (seeded with `query`).
 *   - `[data-search-count]` … result-count text, live-updated by the enhancer.
 *   - `[data-search-list]`  … the result `<ul>`, rebuilt by the enhancer.
 *   - `[data-search-empty]` … the zero-results message, `hidden`-toggled.
 */
import type { SearchDoc } from "../search-doc";
import { matchDoc } from "../search-doc";
import {
  ROW_LINK_CLASS,
  ROW_HEADER_CLASS,
  ROW_TITLE_CLASS,
  ROW_BADGE_CLASS,
  ROW_LEAD_CLASS,
  ROW_HREF_CLASS,
} from "../search-result-item-classes";

export type SearchResultsProps = {
  /** All search documents (the host's full index), SSR-embedded for the enhancer. */
  docs: SearchDoc[];
  /** Initial query (e.g. from a `?q=` search param). Empty string matches everything. */
  query: string;
  /** Search endpoint the plain-HTML `<form>` submits to. Defaults to "/search". */
  action?: string;
};

export function SearchResults({ docs, query, action = "/search" }: SearchResultsProps) {
  const lower = query.trim().toLowerCase();
  // SSR initial list: pre-filtered when `query` is non-empty, so the page is
  // never inconsistent even before the enhancer takes over. Uses the same
  // matchDoc the enhancer uses client-side, so SSR and CSR never disagree.
  const initial = docs.filter((d) => matchDoc(d, lower));

  return (
    <div data-search-root>
      {/* Search index, embedded as JSON for the enhancer to JSON.parse and
          filter client-side. `<` is escaped to guard against early `</script>`
          termination when a doc field contains it. */}
      <script
        type="application/json"
        data-search-index
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(docs).replace(/</g, "\\u003c"),
        }}
      />

      {/* Plain-HTML search box. Submitting it (JS disabled, or before hydration)
          navigates to `${action}?q=...`, where an SSR-filtered list is the
          fallback — the enhancer live-updates in place once it hydrates. */}
      <form
        role="search"
        action={action}
        method="get"
        class="mb-vsp-lg flex items-center gap-hsp-sm rounded-full border border-border bg-surface px-hsp-md py-vsp-2xs"
      >
        <span class="text-muted" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          name="q"
          value={query}
          data-search-input
          placeholder="Search the site"
          aria-label="Site search"
          class="w-full border-0 bg-transparent text-small text-fg outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          class="whitespace-nowrap rounded-full border border-border bg-bg px-hsp-md py-vsp-2xs text-caption font-medium text-fg transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          Search
        </button>
      </form>

      {/* Result count, live-updated by the enhancer. */}
      <p class="mb-vsp-md text-caption text-muted" aria-live="polite">
        <span data-search-count>{initial.length}</span> results
        {lower !== "" && (
          <>
            {" for "}
            <b class="font-bold text-fg">&ldquo;{query.trim()}&rdquo;</b>
          </>
        )}
      </p>

      {/* Result list. SSR renders `initial`; the enhancer rebuilds this on
          `?q=`/input changes from the full embedded index. */}
      <ul data-search-list class="flex flex-col gap-vsp-sm">
        {initial.map((doc) => (
          <SearchResultItem key={doc.href} doc={doc} />
        ))}
      </ul>

      {/* Zero-results message. SSR toggles `hidden` off the initial count; the
          enhancer keeps it in sync as the list changes. */}
      <p
        data-search-empty
        hidden={initial.length > 0}
        class="rounded-md border border-border bg-surface px-hsp-md py-vsp-md text-small text-muted"
      >
        No matching pages found. Try a different keyword.
      </p>
    </div>
  );
}

/**
 * One result row: title (link) + section badge + description/excerpt lead.
 * Class strings come from `search-result-item-classes.ts` — the same
 * constants `search-result-item-renderer.ts` uses for the CSR path, so both
 * stay byte-identical for the same doc.
 */
function SearchResultItem({ doc }: { doc: SearchDoc }) {
  return (
    <li>
      <a href={doc.href} class={ROW_LINK_CLASS}>
        <span class={ROW_HEADER_CLASS}>
          <b class={ROW_TITLE_CLASS}>{doc.title}</b>
          {doc.section && <span class={ROW_BADGE_CLASS}>{doc.section}</span>}
        </span>
        {(doc.description || doc.excerpt) && (
          <span class={ROW_LEAD_CLASS}>{doc.description || doc.excerpt}</span>
        )}
        <span class={ROW_HREF_CLASS}>{doc.href}</span>
      </a>
    </li>
  );
}
