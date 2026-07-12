import { z } from "zod";

// ---------------------------------------------------------------------------
// Demo content frontmatter zod schema — single source of the TypeScript type
// (via `z.infer`) AND the JSON schema handed to zfb's `content` collection
// (see zfb.config.ts, `z.toJSONSchema(buildContentSchema())`).
//
// Nav-related fields (section / navLabel / navOrder / sectionOrder /
// navHidden) are read by lib/site-tree.ts. Render fields (title /
// description / category / date) are read by pages/[...slug].tsx.
// ---------------------------------------------------------------------------

/**
 * Builds the demo's content frontmatter zod schema.
 *
 * `.passthrough()` lets unknown frontmatter fields flow through unvalidated
 * rather than stripped or rejected, so content authors can add ad-hoc fields
 * without a schema change.
 */
export function buildContentSchema() {
  return z
    .object({
      /** Page title. */
      title: z.string().optional(),
      /** Lead/meta description. */
      description: z.string().optional(),
      /** Category (news-style listings). */
      category: z.string().optional(),
      /** Date (news-style listings). */
      date: z.string().optional(),
      // --- Nav fields (read by lib/site-tree.ts) ---
      /** Nav/footer section label. Defaults to the slug's first segment. */
      section: z.string().optional(),
      /** Nav/footer link label. Defaults to title, then the slug's last segment. */
      navLabel: z.string().optional(),
      /** Ascending sort order within a section. Omitted sorts last. */
      navOrder: z.number().optional(),
      /** Ascending sort order for the section itself. Section's order is its min. */
      sectionOrder: z.number().optional(),
      /** When true, excludes the page from nav/footer (the page itself still builds). */
      navHidden: z.boolean().optional(),
    })
    .passthrough();
}

/** TypeScript type derived from {@link buildContentSchema}. */
export type ContentData = z.infer<ReturnType<typeof buildContentSchema>>;
