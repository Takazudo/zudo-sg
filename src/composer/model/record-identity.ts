// Provider-neutral Composition record identity.
//
// A source binding persists only this record id. Provider selection belongs to
// the containing record at runtime, so this module intentionally has no library
// or storage imports.

/** A Composition record id in its provider's namespace. */
export type CompositionRecordId = string;

/**
 * Lower-case, case-stable ids safe to embed in owned filenames and URL paths.
 * Dots, separators, percent escapes, whitespace, and leading/trailing
 * punctuation are deliberately excluded. IDs are capped to keep filenames
 * portable across providers.
 */
export const COMPOSITION_RECORD_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/;

export function isSafeCompositionRecordId(value: unknown): value is CompositionRecordId {
  return typeof value === "string" && COMPOSITION_RECORD_ID_PATTERN.test(value);
}
