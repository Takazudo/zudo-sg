/**
 * Single source of truth for the search-result-row class strings.
 *
 * `search-results.tsx` (SSR JSX) and `search-result-item-renderer.ts` (CSR
 * `innerHTML` string-builder, used by the enhancer island) must render
 * byte-identical markup for the same doc — both import these constants
 * instead of duplicating class strings, so the two can never drift.
 *
 * This module is deliberately framework-free (no preact/JSX import) so it can
 * be imported from the CSR string-renderer without pulling any render tree
 * into the island bundle.
 */

/** Class for the `<a>` wrapping one result row. */
export const ROW_LINK_CLASS =
  "block rounded-md border border-border bg-surface px-hsp-md py-vsp-sm no-underline transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/** Class for the flex row wrapping the title + section badge. */
export const ROW_HEADER_CLASS = "flex flex-wrap items-baseline gap-x-hsp-sm gap-y-vsp-2xs";

/** Class for the title `<b>`. */
export const ROW_TITLE_CLASS = "text-title font-bold text-fg";

/** Class for the section badge `<span>`. */
export const ROW_BADGE_CLASS =
  "rounded-full border border-border bg-bg px-hsp-sm py-vsp-2xs text-micro text-muted";

/** Class for the lead (description/excerpt) `<span>`. */
export const ROW_LEAD_CLASS = "mt-vsp-2xs block text-caption text-muted";

/** Class for the href caption `<span>`. */
export const ROW_HREF_CLASS = "mt-vsp-2xs block text-micro text-muted";
