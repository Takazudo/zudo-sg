/**
 * CSR (`innerHTML`) renderer for one search-result row.
 *
 * Framework-free — no JSX/preact import — so the enhancer island doesn't need
 * to bundle `preact-render-to-string` just to redraw the result list. Class
 * strings come from `search-result-item-classes.ts`, the same module the SSR
 * JSX component uses, so both sides render identical markup for the same doc
 * (see the shared contract test in `../__tests__/search-result-item-contract.test.ts`).
 */
import type { SearchDoc } from "./search-doc";
import {
  ROW_LINK_CLASS,
  ROW_HEADER_CLASS,
  ROW_TITLE_CLASS,
  ROW_BADGE_CLASS,
  ROW_LEAD_CLASS,
  ROW_HREF_CLASS,
} from "./search-result-item-classes";

/** Escapes HTML special characters — required before any string lands in `innerHTML`. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the `<li>` HTML for one result, matching the SSR JSX structure
 * exactly (see `search-results/search-results.tsx`'s row component).
 */
export function renderItem(doc: SearchDoc): string {
  const title = escapeHtml(doc.title);
  // href is escaped for both the attribute value and the visible caption text
  // — attribute-value escaping matters here because this string lands via
  // `innerHTML` (unlike JSX, which escapes attributes automatically).
  const safeHref = escapeHtml(doc.href);
  const section = doc.section
    ? `<span class="${ROW_BADGE_CLASS}">${escapeHtml(doc.section)}</span>`
    : "";
  const lead = doc.description || doc.excerpt;
  const leadHtml = lead ? `<span class="${ROW_LEAD_CLASS}">${escapeHtml(lead)}</span>` : "";
  return [
    "<li>",
    `<a href="${safeHref}" class="${ROW_LINK_CLASS}">`,
    `<span class="${ROW_HEADER_CLASS}">`,
    `<b class="${ROW_TITLE_CLASS}">${title}</b>`,
    section,
    "</span>",
    leadHtml,
    `<span class="${ROW_HREF_CLASS}">${safeHref}</span>`,
    "</a>",
    "</li>",
  ].join("");
}
