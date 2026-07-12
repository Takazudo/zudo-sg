/**
 * Meta-tag utilities.
 *
 * composeMetaTitle: builds a "<page title> | <siteName>" string, collapsing
 * to just `siteName` when they're equal (e.g. the home page) so it doesn't
 * read as "Demo Site | Demo Site".
 *
 * absoluteUrl: joins `siteMeta.siteUrl` + a page path into an absolute URL,
 * or returns undefined while `siteUrl` is unset — callers skip emitting
 * canonical/og:url rather than emitting a broken absolute URL.
 */
import { siteMeta } from "../config/site-meta";

export function composeMetaTitle(title: string): string {
  const { siteName } = siteMeta;
  if (!siteName) return title;
  if (title === siteName) return siteName;
  return `${title} | ${siteName}`;
}

/** `pageUrl` must start with `/` (e.g. `/company/about`); a missing leading slash is added. */
export function absoluteUrl(pageUrl: string): string | undefined {
  if (!siteMeta.siteUrl) return undefined;
  const normalizedPage = pageUrl.startsWith("/") ? pageUrl : `/${pageUrl}`;
  return siteMeta.siteUrl.replace(/\/$/, "") + normalizedPage;
}
