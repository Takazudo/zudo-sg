/**
 * Search result record + match predicate shared by the SSR search-results
 * component and its CSR enhancer island. Building the actual index (crawling
 * content, deriving section labels, deriving excerpts) is host/build-time
 * work that depends on the consumer's own content pipeline — it stays out of
 * @zudo-sg/ui. This module only carries the wire shape + the pure filter both
 * sides must apply identically so SSR and CSR results never drift.
 */

/** One search result record (the shape a host's search index embeds as JSON). */
export type SearchDoc = {
  /** Result title. */
  title: string;
  /** Result href. */
  href: string;
  /** Section/category label shown as a badge. */
  section: string;
  /** Lead description, preferred over `excerpt` when both are present. */
  description: string;
  /** Body excerpt, shown when `description` is empty. */
  excerpt: string;
};

/**
 * Whether `doc` matches `lowerQuery` (already trimmed + lower-cased by the
 * caller). Empty query matches everything. Checked against title, section,
 * description, and excerpt — used identically by the SSR initial filter and
 * the CSR live-filter so both stay in lockstep.
 */
export function matchDoc(doc: SearchDoc, lowerQuery: string): boolean {
  if (lowerQuery === "") return true;
  return (
    doc.title.toLowerCase().includes(lowerQuery) ||
    doc.section.toLowerCase().includes(lowerQuery) ||
    doc.description.toLowerCase().includes(lowerQuery) ||
    doc.excerpt.toLowerCase().includes(lowerQuery)
  );
}
