/**
 * News feed derivation — builds the "news" listing from the content
 * collection. The landing page, `/news`, and `/ir/news` all share the same
 * "date / category / title" row; this module is the single source for that
 * row data.
 *
 * Walks `getCollection("content")`, keeps only `content/news/` entries
 * (excluding the listing page itself), and returns them date-descending.
 * Owning news article files is `pages/_mdx-content-sections.tsx`'s /
 * content authors' job — this module doesn't require any articles to exist
 * and returns `[]` on an empty/missing collection.
 *
 * frontmatter contract (content/news/<slug>.md(x) YAML):
 *   date:      string  Article date. ISO ("2026-06-19") expected — the
 *                       descending-sort key.
 *   category:  string  Category label (e.g. 企業 / 製品 / サステナビリティ /
 *                       展示会 / IR).
 *   title:     string  Heading (falls back to frontmatter.title, then the
 *                       slug's last segment).
 *   href:      string? Explicit link to an external article/other URL,
 *                       taking priority over the derived detail URL.
 *
 * NOTE: `getCollection` is synchronous per ADR-004 — this completes in a
 * single SSR pass, matching lib/site-tree.ts's convention.
 */
import { getCollection } from "@takazudo/zfb/content";
import { normalizeSlug, slugToHref } from "./site-tree";

/** Expected shape of a news article's frontmatter (title aside, date/category are effectively required). */
type NewsFrontmatter = {
  title?: string;
  date?: string;
  category?: string;
  href?: string;
};

/** One news-feed row — the minimal data NewsList renders. */
export type NewsItem = {
  /** Article date (raw frontmatter value, ISO "2026-06-19" expected). Display formatting is NewsList's job. */
  date: string;
  /** Category label. */
  category: string;
  /** Heading. */
  title: string;
  /** Explicit link (e.g. an external article). Takes priority over the derived `/news/<slug>` detail URL. */
  href?: string;
  /** Normalized slug — used to derive the detail URL and as a list key. */
  slug: string;
};

/** Filter/limit options for {@link getNews}. */
export type GetNewsOptions = {
  /** When set, only entries in this category are returned. */
  category?: string;
  /** When set, returns at most this many entries (top of the date-descending list). */
  limit?: number;
};

/** Is this normalized slug a news-feed entry (under `content/news/`, excluding the listing page itself)? */
function isFeedEntry(normalizedSlug: string): boolean {
  if (normalizedSlug === "news") return false;
  return normalizedSlug.startsWith("news/");
}

/** Builds a naive title from the slug's last segment — the last-resort fallback when `title` is unset. */
function fallbackTitle(slug: string): string {
  const last = slug.split("/").filter(Boolean).pop() ?? slug;
  return last.replace(/[-_]/g, " ");
}

/**
 * Pure entries -> NewsItem[] mapper, so tests can pass fixture entries
 * without mocking `getCollection`. Entries missing `date` or `category`
 * are dropped — an incomplete row would render half-empty.
 */
export function buildNewsFromEntries(
  entries: Array<{ slug: string; data?: NewsFrontmatter }>,
): NewsItem[] {
  const items: NewsItem[] = [];
  for (const entry of entries) {
    const norm = normalizeSlug(entry.slug);
    if (!isFeedEntry(norm)) continue;
    const data = entry.data ?? {};
    if (!data.date || !data.category) continue;
    items.push({
      date: data.date,
      category: data.category,
      title: data.title ?? fallbackTitle(norm),
      href: data.href,
      slug: norm,
    });
  }
  // Date-descending (newest first). `date` is an ISO string, so lexicographic
  // comparison already sorts chronologically.
  items.sort((a, b) => b.date.localeCompare(a.date));
  return items;
}

/**
 * Reads the news feed from the content collection. Synchronous — safe to
 * call from anywhere during SSR.
 *
 * @param options.category Restrict to a single category.
 * @param options.limit    Cap the result to this many entries (top of the date-descending list).
 */
export function getNews({ category, limit }: GetNewsOptions = {}): NewsItem[] {
  let items: NewsItem[] = [];
  try {
    const entries = getCollection<NewsFrontmatter>("content");
    items = buildNewsFromEntries(entries);
  } catch {
    // No/empty content collection shouldn't crash the build.
    items = [];
  }

  if (category) {
    items = items.filter((item) => item.category === category);
  }
  if (typeof limit === "number") {
    items = items.slice(0, Math.max(0, limit));
  }
  return items;
}

/** A NewsItem's detail URL: its explicit `href` if set, else `/news/<slug>`-shaped from the slug. */
export function newsHref(item: NewsItem): string {
  return item.href ?? slugToHref(item.slug);
}

/** Formats an ISO date ("2026-06-19") as "2026.06.19". Returns the raw value if unparseable. */
export function formatNewsDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  return `${match[1]}.${match[2]}.${match[3]}`;
}
