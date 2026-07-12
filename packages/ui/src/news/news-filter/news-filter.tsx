import { cx } from "../../lib/cx";

export type NewsFilterProps = {
  /** Options to show, in addition to the always-first "All". */
  categories: string[];
  class?: string;
};

/**
 * NewsFilter — category-filter button group for a news feed. Progressive
 * enhancement: this SSR markup alone does nothing on click — NewsList
 * already renders every row (see its `[data-news-category]` hook), so with no
 * client JS the buttons show but the list stays fully visible (the static
 * fallback). The paired `NewsFilterEnhancer` island (same directory) is what
 * wires clicks to show/hide rows; @zudo-sg/ui takes no zfb dependency, so
 * mounting that island (`<Island when="visible" ssrFallback={null}>`) is the
 * consuming app's job, not this component's — it finds this filter and its
 * target list via `[data-news-filter]`/`[data-news-list]`, not DOM nesting.
 *
 * DOM hooks the paired enhancer relies on:
 *   root      [data-news-filter]
 *   buttons   [data-news-filter-btn][data-category="<cat>"|"" (All)]
 *   target    the nearest ancestor `<section>`'s [data-news-list] > li[data-news-category]
 */
export function NewsFilter({ categories, class: cls }: NewsFilterProps) {
  return (
    <div
      class={cx("flex flex-wrap gap-x-hsp-xs gap-y-vsp-2xs", cls)}
      role="group"
      aria-label="Filter by category"
      data-news-filter
    >
      <FilterButton category="" label="All" pressed />
      {categories.map((cat) => (
        <FilterButton key={cat} category={cat} label={cat} />
      ))}
    </div>
  );
}

type FilterButtonProps = {
  /** Category value ("" = show all). */
  category: string;
  label: string;
  pressed?: boolean;
};

function FilterButton({ category, label, pressed = false }: FilterButtonProps) {
  return (
    <button
      type="button"
      data-news-filter-btn
      data-category={category}
      aria-pressed={pressed ? "true" : "false"}
      class={cx(
        "cursor-pointer rounded-full border border-border bg-bg",
        "px-hsp-sm py-vsp-2xs",
        "text-caption font-medium text-muted transition-colors",
        "hover:border-accent hover:text-accent",
        "aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-bg",
      )}
    >
      {label}
    </button>
  );
}
