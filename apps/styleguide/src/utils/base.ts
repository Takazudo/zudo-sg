import { settings } from "@/config/settings";

/** Normalized base path with no trailing slash (empty string when "/"). */
export const normalizedBase = settings.base.replace(/\/+$/, "");

/**
 * Append a trailing slash to page URLs when `settings.trailingSlash` is true.
 * Skips paths that already end with `/`, contain a file extension, or have a
 * query string / fragment before the slash would be inserted.
 */
export function applyTrailingSlash(url: string): string {
  if (!settings.trailingSlash) return url;
  if (url.endsWith("/")) return url;
  const suffixIdx = url.search(/[?#]/);
  const pathPart = suffixIdx >= 0 ? url.slice(0, suffixIdx) : url;
  const suffix = suffixIdx >= 0 ? url.slice(suffixIdx) : "";
  if (pathPart.endsWith("/")) return url;
  const lastSegment = pathPart.split("/").pop() ?? "";
  if (/\.[a-zA-Z]\w*$/.test(lastSegment)) return url;
  return pathPart + "/" + suffix;
}

/** Prefix a path with the configured base directory. */
export function withBase(path: string): string {
  const raw =
    normalizedBase === ""
      ? path
      : `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
  return applyTrailingSlash(raw);
}

/** Strip the base prefix from a URL pathname. */
export function stripBase(path: string): string {
  if (normalizedBase === "") return path;
  if (path === normalizedBase) return "/";
  return path.startsWith(`${normalizedBase}/`)
    ? path.slice(normalizedBase.length)
    : path;
}

/**
 * Build an absolute URL by joining `settings.siteUrl` (trailing slash stripped)
 * with a base-prefixed page path. Returns `undefined` when `siteUrl` is unset.
 */
export function absoluteUrl(pageUrl: string): string | undefined {
  return settings.siteUrl ? settings.siteUrl.replace(/\/$/, "") + pageUrl : undefined;
}
