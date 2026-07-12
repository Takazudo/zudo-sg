/**
 * Demo site meta config (canonical / OGP / Twitter Card).
 *
 * `siteName` matches the fictional dummy corporate name already baked into
 * the ported content collection (e.g. `content/company/profile.mdx`'s
 * company-profile table) so the `<title>`/OGP brand and the body copy don't
 * disagree with each other.
 *
 * siteUrl stays "" until a real deploy URL is assigned — absoluteUrl()
 * returns undefined in that case rather than emitting a broken canonical/og:url.
 */
export const siteMeta: {
  siteName: string;
  /** No trailing slash. Empty string means canonical/OG URLs are not emitted. */
  siteUrl: string;
} = {
  siteName: "ダミー株式会社",
  siteUrl: "",
};
