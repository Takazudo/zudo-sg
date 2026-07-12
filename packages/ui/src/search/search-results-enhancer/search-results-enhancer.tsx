"use client";

/**
 * SearchResultsEnhancer — client-side live filtering for `SearchResults`
 * (progressive enhancement island).
 *
 * `SearchResults` already renders a full, correct result list server-side
 * (pre-filtered when a query is present) — the page works with no JS. This
 * island only adds the "better with JS" behavior:
 *   1. On mount, read `?q=` from the URL and re-filter the embedded index
 *      client-side, so SSR and CSR agree even when SSR served an unfiltered
 *      (empty-query) list.
 *   2. Live-filter as the user types in the search box, updating the result
 *      count and list in place.
 *   3. Keep `?q=` in the URL in sync via `history.replaceState`, so reload/
 *      share restores the current filter.
 *
 * Filtering uses `matchDoc` from `../search-doc` — the exact same predicate
 * `SearchResults` uses server-side, so the two can never disagree. Row markup
 * comes from `../search-result-item-renderer`'s `renderItem`, which shares its
 * class constants with `SearchResults`'s SSR JSX (see
 * `../search-result-item-classes.ts`) — NOT `preact-render-to-string`, which
 * would otherwise bloat this island's bundle for every page that mounts it.
 *
 * Render-null pattern: this component renders nothing (`return null`) and
 * only attaches behavior to the existing SSR markup via the `data-search-*`
 * hooks documented in `../search-results/search-results.tsx`. The consumer is
 * responsible for mounting it — typically:
 *
 * ```tsx
 * <Island when="visible" ssrFallback={null}>
 *   <SearchResultsEnhancer />
 * </Island>
 * ```
 *
 * `ssrFallback={null}` is required: this component has no meaningful SSR
 * output, so there is nothing worth evaluating (or safe to evaluate, for a
 * skip-SSR `<Island>`) on the server.
 *
 * SPA-swap idempotency: `[data-search-root]` gets a `dataset.searchEnhanced`
 * guard, and all listeners are bound through one `AbortController`. If the
 * island is torn down and remounted (e.g. after a client-router page swap),
 * the guard is cleared on cleanup so re-enhancing is safe.
 */
import { useEffect } from "preact/hooks";
import type { SearchDoc } from "../search-doc";
import { matchDoc } from "../search-doc";
import { renderItem } from "../search-result-item-renderer";

function enhance(): () => void {
  const root = document.querySelector<HTMLElement>("[data-search-root]");
  if (!root) return () => {};
  if (root.dataset.searchEnhanced === "true") return () => {};

  const script = root.querySelector<HTMLScriptElement>("[data-search-index]");
  const input = root.querySelector<HTMLInputElement>("[data-search-input]");
  const count = root.querySelector<HTMLElement>("[data-search-count]");
  const list = root.querySelector<HTMLElement>("[data-search-list]");
  const empty = root.querySelector<HTMLElement>("[data-search-empty]");
  if (!script || !input || !count || !list || !empty) return () => {};

  let docs: SearchDoc[];
  try {
    docs = JSON.parse(script.textContent ?? "[]") as SearchDoc[];
  } catch {
    return () => {};
  }

  root.dataset.searchEnhanced = "true";
  const ac = new AbortController();
  const { signal } = ac;

  const apply = (rawQuery: string) => {
    const lower = rawQuery.trim().toLowerCase();
    const matched = docs.filter((d) => matchDoc(d, lower));
    list.innerHTML = matched.map(renderItem).join("");
    count.textContent = String(matched.length);
    empty.hidden = matched.length > 0;
  };

  // Keep `?q=` in the URL in sync via history so reload/share restores it.
  const syncUrl = (rawQuery: string) => {
    const q = rawQuery.trim();
    const url = new URL(window.location.href);
    if (q === "") url.searchParams.delete("q");
    else url.searchParams.set("q", q);
    window.history.replaceState(null, "", url.toString());
  };

  // Initial sync: reflect `?q=` into the input, then re-filter the SSR list
  // client-side (aligns SSR's possibly-unfiltered list with the URL's query).
  const initialQuery = new URL(window.location.href).searchParams.get("q") ?? input.value ?? "";
  if (input.value !== initialQuery) input.value = initialQuery;
  apply(initialQuery);

  input.addEventListener(
    "input",
    () => {
      apply(input.value);
      syncUrl(input.value);
    },
    { signal },
  );

  return () => {
    ac.abort();
    delete root.dataset.searchEnhanced;
  };
}

export default function SearchResultsEnhancer() {
  useEffect(() => {
    const dispose = enhance();
    return dispose;
  }, []);
  return null;
}
