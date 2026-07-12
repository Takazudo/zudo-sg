// Versioned localStorage persistence for the Composer document (issue #247).
//
// Wraps #245's `loadCompositionDocument` / `resetToSample` with the actual
// browser storage I/O, and decides — per the model's own contract — when a
// load outcome should be written back:
//
//   - "fresh" / "recovered" — storage held nothing usable under the
//     supported schema, so the resolved sample is written back immediately.
//     Otherwise every reload would re-trigger the same "recovered" notice.
//   - "quarantined" — storage holds a NEWER schema this build does not
//     understand. #245 is explicit: "only an explicit resetToSample
//     overwrites quarantined data." So this module never writes here, either
//     at load or from any later autosave — see `use-composer-controller.ts`,
//     which gates its autosave effect on `loadNotice.kind !== "quarantined"`
//     until an explicit Reset clears it.
//   - "ok" — storage already matches; nothing to write.
//
// Every localStorage call is wrapped in try/catch: private-mode Safari,
// full quota, and disabled storage must never prevent the app from starting,
// and the honest answer ("not saved") flows back through the write result
// rather than throwing.

import type { CompositionDocument, LoadOutcome } from "@/composer";
import { loadCompositionDocument, resetToSample } from "@/composer";

/** localStorage key for the persisted Composition document. */
export const COMPOSER_DOCUMENT_STORAGE_KEY = "sg-composer-document";

export interface ComposerStorageWriteResult {
  ok: boolean;
  /** Present when `ok` is false — a human-readable reason (never thrown). */
  error?: string;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private-mode / storage disabled — treated the same as "nothing stored".
    return null;
  }
}

/** Read + validate the persisted document against #245's recovery contract. */
export function loadComposerDocument(
  sample: CompositionDocument,
  key: string = COMPOSER_DOCUMENT_STORAGE_KEY,
): LoadOutcome {
  return loadCompositionDocument(readRaw(key), sample);
}

/**
 * Persist a document. Never throws — a quota / private-mode failure is
 * reported through the return value so the UI can honestly show "not saved".
 */
export function saveComposerDocument(
  document: CompositionDocument,
  key: string = COMPOSER_DOCUMENT_STORAGE_KEY,
): ComposerStorageWriteResult {
  try {
    localStorage.setItem(key, JSON.stringify(document));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Storage write failed" };
  }
}

/** The explicit Reset action: always allowed to overwrite storage, even quarantined data. */
export function resetComposerStorage(
  sample: CompositionDocument,
  key: string = COMPOSER_DOCUMENT_STORAGE_KEY,
): { document: CompositionDocument; write: ComposerStorageWriteResult } {
  const document = resetToSample(sample);
  return { document, write: saveComposerDocument(document, key) };
}

export interface ComposerStorageInitResult {
  outcome: LoadOutcome;
  /** Null when the outcome intentionally skipped a write-back (quarantined / already ok). */
  write: ComposerStorageWriteResult | null;
}

/**
 * Load the persisted document and normalize storage per the outcome matrix
 * above. This is the single entry point `use-composer-controller.ts` calls
 * on mount.
 */
export function initializeComposerStorage(
  sample: CompositionDocument,
  key: string = COMPOSER_DOCUMENT_STORAGE_KEY,
): ComposerStorageInitResult {
  const outcome = loadComposerDocument(sample, key);
  if (outcome.status === "fresh" || outcome.status === "recovered") {
    return { outcome, write: saveComposerDocument(outcome.document, key) };
  }
  // "ok" already matches storage; "quarantined" must never be overwritten
  // implicitly — see file header.
  return { outcome, write: null };
}
