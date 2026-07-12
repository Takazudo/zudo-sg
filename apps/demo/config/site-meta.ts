/**
 * Demo site meta config (canonical / OGP / Twitter Card).
 *
 * Shell-only placeholder (Wave 5 #232) — `siteName`/`siteUrl` are neutral
 * stand-ins so `lib/meta.ts` and `layouts/default.tsx` have something to
 * render before the content sub (#233) lands. #233 replaces the values here
 * with the finalized neutral demo copy; the shape (siteName/siteUrl) is the
 * stable contract other files import.
 *
 * siteUrl stays "" until a real deploy URL is assigned — absoluteUrl()
 * returns undefined in that case rather than emitting a broken canonical/og:url.
 */
export const siteMeta: {
  siteName: string;
  /** No trailing slash. Empty string means canonical/OG URLs are not emitted. */
  siteUrl: string;
} = {
  siteName: "Demo Site",
  siteUrl: "",
};
