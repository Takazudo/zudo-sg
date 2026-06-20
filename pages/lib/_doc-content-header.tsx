/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared content header block for entry doc pages.
//
// Extracted from the four doc-route render bodies (pages/docs/[...slug].tsx,
// pages/[locale]/docs/[...slug].tsx, pages/v/[version]/docs/[...slug].tsx,
// pages/v/[version]/[locale]/docs/[...slug].tsx) where the block was
// duplicated verbatim across all four entry branches.
//
// Covers the block from the <h1> through <FrontmatterPreview> (inclusive).
// The MDX <Content /> remains inline in each route.

import type { JSX } from "preact";
import { t } from "@/config/i18n";
import { FrontmatterPreview } from "@takazudo/zudo-doc/metainfo";
import { frontmatterRenderers } from "@/config/frontmatter-preview-renderers";
import { DocTagsArea } from "./_doc-tags-area";
import { buildFrontmatterPreviewEntries } from "./_frontmatter-preview-data";
import type { DocPageEntry } from "./doc-page-props";

interface DocContentHeaderProps {
  /** The full content entry (title, description, tags, frontmatter data). */
  entry: DocPageEntry;
  /** Canonical page slug for DocTagsArea lookups. */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /**
   * True when this page falls back to the base EN collection for a locale
   * route. Renders the "not yet translated" notice. Defaults to false.
   * Only relevant for locale-prefixed and versioned-locale routes.
   */
  isFallback?: boolean;
  /**
   * Version slug when rendering a versioned route (e.g. "1.0"); undefined =
   * latest. On versioned pages the tag chips are hidden — tag routes are
   * built from latest frontmatter only, so a version-only tag chip would
   * link to a latest tag route that may not exist (404).
   */
  version?: string;
}

/**
 * Content header block for entry doc pages: h1, tag chips, optional
 * locale-fallback notice, description paragraph, and frontmatter preview
 * table.
 *
 * Placement: at the top of the article `<Fragment>`, before
 * `<props.entry.Content />` and the pager.
 */
export function DocContentHeader({
  entry,
  slug,
  locale,
  isFallback = false,
  version,
}: DocContentHeaderProps): JSX.Element {
  return (
    <>
      <h1 class="text-heading font-bold mb-vsp-xs">{entry.data.title}</h1>

      {/* Page-level tag chips — matching doc-tags placement (#1658).
          Hidden on versioned pages: tag routes are built from latest
          frontmatter only, so a version-only tag chip would 404 (see the
          `version` prop doc above). */}
      {!version && <DocTagsArea slug={slug} locale={locale} tags={entry.data.tags} />}

      {/* Fallback notice for non-translated pages */}
      {isFallback && !entry.data.generated && (
        <div
          class="mb-vsp-md border border-info/30 bg-info/5 px-hsp-lg py-vsp-sm text-small text-muted rounded"
          role="note"
        >
          {t("doc.fallbackNotice", locale)}
        </div>
      )}

      {entry.data.description && (
        <p class="mb-vsp-lg text-title text-muted">
          {entry.data.description}
        </p>
      )}

      {/* Frontmatter preview — non-system, custom keys only. Returns
          null when the entries array is empty, so pages without
          custom frontmatter emit nothing. Custom per-key renderers
          from frontmatter-preview-renderers.tsx produce styled cells
          (pills, badges, etc.) instead of plain text. */}
      <FrontmatterPreview
        entries={buildFrontmatterPreviewEntries(entry.data)}
        title={t("frontmatter.preview.title", locale)}
        keyColLabel={t("frontmatter.preview.keyCol", locale)}
        valueColLabel={t("frontmatter.preview.valueCol", locale)}
        renderers={frontmatterRenderers}
        data={entry.data as Record<string, unknown>}
        locale={locale}
      />
    </>
  );
}
