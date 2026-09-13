import { NewsList, type NewsItem } from "../news-list/news-list";
import { ViewAllLink } from "../../shared/card-link/card-link";

export type NewsTeaserProps = {
  /** Section heading (e.g. "News", "IR News"). */
  heading: string;
  /** Feed rows to render — already filtered/sorted/limited by the caller. */
  items: NewsItem[];
  /** "View all" link target. */
  viewAllHref: string;
  /** "View all" link label. */
  viewAllLabel?: string;
  /** Optional supporting copy under the heading. */
  intro?: string;
  class?: string;
};

/**
 * NewsTeaser — landing-page "News" / "IR News" excerpt band: a heading row
 * (with a "view all" link at the end) over NewsList's latest N rows, unfiltered.
 * One component serves both the general news feed and the IR-only feed — the
 * caller decides by what it passes as `items`.
 */
export function NewsTeaser({
  heading,
  items,
  viewAllHref,
  viewAllLabel = "View all",
  intro,
  class: cls,
}: NewsTeaserProps) {
  return (
    <section class={cls} aria-label={heading}>
      <div class="flex flex-col gap-y-vsp-2xs sm:flex-row sm:items-end sm:justify-between sm:gap-x-hsp-md">
        <h2 class="text-heading font-bold leading-tight text-fg">{heading}</h2>
        <ViewAllLink href={viewAllHref} class="shrink-0">
          {viewAllLabel}
        </ViewAllLink>
      </div>
      {intro && (
        <p class="mt-vsp-xs max-w-[44rem] text-small leading-relaxed text-fg" style={{ textWrap: "pretty" }}>
          {intro}
        </p>
      )}

      {/* Heading already shown above, so NewsList's own heading is omitted. */}
      <NewsList showFilter={false} items={items} class="mt-vsp-md" />
    </section>
  );
}
