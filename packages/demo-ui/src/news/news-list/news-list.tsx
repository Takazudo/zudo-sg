import { cx } from "../../lib/cx";
import { CategoryBadge } from "../category-badge/category-badge";
import { NewsFilter } from "../news-filter/news-filter";

/** One row of a news feed. Deriving/fetching this data is the consuming app's job. */
export type NewsItem = {
  /** ISO date string (e.g. "2026-06-19"); formatted for display as "2026.06.19". */
  date: string;
  category: string;
  title: string;
  /** Explicit link; takes priority over the `/${slug}` URL derived below. */
  href?: string;
  /** Slug used to derive the detail URL when `href` is absent (no leading/trailing slash). */
  slug: string;
};

export type NewsListProps = {
  /** Feed rows to render, already filtered/sorted/limited by the caller. */
  items: NewsItem[];
  /**
   * Shows a category-filter bar (NewsFilter) above the list. It's a
   * progressive-enhancement UI on its own — see news-filter.tsx — so the
   * list still renders every item with no client JS.
   */
  showFilter?: boolean;
  /** Optional heading (omit for an embedded/headless usage). */
  heading?: string;
  class?: string;
};

/**
 * NewsList — shared "date / category badge / title" feed row, used directly
 * for a news index page and via NewsTeaser for a landing-page excerpt.
 *
 * Unlike the reference this ports from, this component takes NO dependency on
 * a content layer — `items` is a required prop; deriving/filtering/limiting
 * the feed (equivalent to the reference's `getNews()`) is the consuming app's
 * job (@zudo-sg/ui takes no zfb-runtime dependency).
 */
export function NewsList({ items, showFilter = false, heading, class: cls }: NewsListProps) {
  const categories = uniqueCategories(items);

  return (
    // aria-label only when there's a heading — an unnamed <section> isn't a
    // landmark, so it won't collide with a parent's landmark name when nested
    // (e.g. inside NewsTeaser).
    <section class={cls} aria-label={heading || undefined}>
      {heading && <h2 class="text-heading font-bold leading-tight text-fg">{heading}</h2>}

      {showFilter && categories.length > 1 && (
        <NewsFilter categories={categories} class={heading ? "mt-vsp-md" : undefined} />
      )}

      {items.length === 0 ? (
        <p class={cx("text-small text-muted", (heading || showFilter) && "mt-vsp-md")}>
          There are no news items yet.
        </p>
      ) : (
        <ul class={cx("list-none p-0", (heading || showFilter) && "mt-vsp-md")} data-news-list>
          {items.map((item) => (
            <NewsRow key={item.slug + item.date} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Collects each item's category once, in first-seen order. */
function uniqueCategories(items: NewsItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      out.push(item.category);
    }
  }
  return out;
}

/** `item.href` if set, else a URL derived from `item.slug`. */
function newsHref(item: NewsItem): string {
  return item.href ?? `/${item.slug}`;
}

/** "2026-06-19" -> "2026.06.19". Falls back to the raw string if unparseable. */
function formatNewsDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

type NewsRowProps = { item: NewsItem };

/**
 * One feed row. Date + badge are fixed-width meta; the title shrinks
 * (`min-w-0`) so it can truncate. `data-news-category` is the hook
 * NewsFilterEnhancer toggles visibility on.
 */
function NewsRow({ item }: NewsRowProps) {
  return (
    <li class="border-t border-border first:border-t-0" data-news-category={item.category}>
      <a
        href={newsHref(item)}
        class={cx(
          "group flex flex-col gap-y-vsp-2xs no-underline",
          "py-vsp-sm transition-colors",
          "sm:flex-row sm:items-baseline sm:gap-x-hsp-md",
        )}
      >
        <span class="flex shrink-0 items-center gap-x-hsp-sm">
          <time class="text-caption tabular-nums text-muted">{formatNewsDate(item.date)}</time>
          <CategoryBadge category={item.category} />
        </span>
        <span class="min-w-0 text-small leading-snug text-fg transition-colors group-hover:text-accent">
          {item.title}
        </span>
      </a>
    </li>
  );
}
