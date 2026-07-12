"use client";

// Catalog search + tag-filter island for the `/components` landing.
//
// The landing's grouped grid is SERVER-RENDERED (no-JS users and crawlers see
// the full catalog). This island is the interactive layer ON TOP: it renders a
// search box + category chips and filters the already-rendered DOM by toggling
// `hidden` on cards / category sections. Keeping the data in the SSR markup
// (via `data-sg-*` attributes) means we don't re-ship the registry into the
// island chunk — the island is tiny and the catalog stays crawlable.
//
// Contract with the SSR markup (pages/components/index.tsx):
//   - The grid root carries `[data-sg-catalog]`.
//   - Each card is `[data-sg-card]` with `data-name`, `data-category`,
//     `data-keywords` (lowercased, space-joined search haystack).
//   - Each category section is `[data-sg-section]` with `data-category`.
//   - A `[data-sg-empty]` element is shown when nothing matches.

import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export interface CatalogFilterProps {
  /** Category labels in display order (drives the chip row). */
  categories: string[];
  /** Total component count, for the result summary. */
  total: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function CatalogFilter({
  categories,
  total,
}: CatalogFilterProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(total);
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply the filter against the SSR-rendered DOM whenever query/category change.
  useEffect(() => {
    const q = normalize(query);
    const root = document.querySelector<HTMLElement>("[data-sg-catalog]");
    if (!root) return;

    const cards = root.querySelectorAll<HTMLElement>("[data-sg-card]");
    let shown = 0;

    for (const card of cards) {
      const name = card.dataset.name ?? "";
      const category = card.dataset.category ?? "";
      const keywords = card.dataset.keywords ?? "";
      const matchesQuery = q === "" || name.includes(q) || keywords.includes(q);
      const matchesCategory =
        activeCategory === null || category === activeCategory;
      const visible = matchesQuery && matchesCategory;
      card.hidden = !visible;
      if (visible) shown++;
    }

    // Hide a category section entirely when none of its cards are visible.
    const sections = root.querySelectorAll<HTMLElement>("[data-sg-section]");
    for (const section of sections) {
      const anyVisible = section.querySelector<HTMLElement>(
        "[data-sg-card]:not([hidden])",
      );
      section.hidden = !anyVisible;
    }

    const empty = root.querySelector<HTMLElement>("[data-sg-empty]");
    if (empty) empty.hidden = shown !== 0;

    setVisibleCount(shown);
  }, [query, activeCategory]);

  // Keyboard shortcut: "/" focuses the search box (unless already typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const summary = useMemo(() => {
    if (query === "" && activeCategory === null) {
      return `${total} component${total === 1 ? "" : "s"}`;
    }
    return `${visibleCount} of ${total} shown`;
  }, [query, activeCategory, visibleCount, total]);

  return (
    <div class="sg-filter">
      <div class="sg-filter-row">
        <div class="sg-search-field">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="text-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onInput={(e) => {
              if (!(e.target instanceof HTMLInputElement)) return;
              setQuery(e.target.value);
            }}
            placeholder="Search components…  ( / )"
            aria-label="Search components by name"
            class="sg-search-input"
            autocomplete="off"
            spellcheck={false}
          />
          {query !== "" && (
            <button
              type="button"
              class="sg-search-clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <span class="text-xs text-muted" aria-live="polite">
          {summary}
        </span>
      </div>

      <div class="sg-chip-row" role="group" aria-label="Filter by category">
        <button
          type="button"
          class="sg-chip"
          aria-pressed={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            class="sg-chip"
            aria-pressed={activeCategory === cat}
            onClick={() =>
              setActiveCategory((prev) => (prev === cat ? null : cat))
            }
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}

CatalogFilter.displayName = "CatalogFilter";
