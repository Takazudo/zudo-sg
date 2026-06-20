import { settings } from "@/config/settings";

/**
 * Compose the canonical "<title> | <siteName>" page-title shape used by
 * both <title> (emitted by DocLayout) and og:title (emitted by HeadWithDefaults).
 *
 * When `title` is identical to `settings.siteName`, returns just the site name
 * to avoid duplication (e.g. "Zudo Sg | Zudo Sg").
 */
export function composeMetaTitle(title: string): string {
  const siteName = settings.siteName;
  if (!siteName) return title;
  if (title === siteName) return siteName;
  return `${title} | ${siteName}`;
}
