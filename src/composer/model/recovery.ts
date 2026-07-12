// Storage recovery + future-schema quarantine.
//
// Loading persisted Composition storage has three interesting failure modes,
// each handled WITHOUT destroying user data:
//
//  - MALFORMED (unparseable, wrong shape, duplicate ids, non-JSON props) under a
//    SUPPORTED schema version → recover to the native production sample.
//  - FUTURE schema (a numeric `schemaVersion` newer than this build supports) →
//    QUARANTINE: surface the sample to work in, but keep the raw storage
//    untouched (`quarantinedRaw`) so a newer build can still read it. Reset is
//    explicit — only an explicit `resetToSample` overwrites quarantined data.
//  - EMPTY (nothing stored yet) → a fresh copy of the sample.
//
// The model only REPORTS the outcome; the persistence layer (wave-3 / #247)
// decides whether to write. A `quarantined` outcome must NOT be written back.

import type { CompositionDocument } from "./types";
import { COMPOSITION_SCHEMA_VERSION } from "./types";
import { cloneJson, isPlainObject } from "./json";
import { isStructurallyValidDocument } from "./validate";

export type LoadOutcome =
  | { status: "fresh"; document: CompositionDocument }
  | { status: "ok"; document: CompositionDocument }
  | { status: "recovered"; document: CompositionDocument; reason: string }
  | {
      status: "quarantined";
      document: CompositionDocument;
      quarantinedRaw: string;
      foundSchemaVersion: number;
    };

/** Reads the `schemaVersion` of a parsed blob, or null when it is not a number. */
function readSchemaVersion(parsed: unknown): number | null {
  if (!isPlainObject(parsed)) return null;
  const version = (parsed as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === "number" && Number.isFinite(version) ? version : null;
}

/**
 * Load persisted storage against a native `sample`. Never throws and never
 * mutates `sample` (it is always cloned into the outcome). See the module
 * header for the outcome matrix.
 */
export function loadCompositionDocument(
  raw: string | null | undefined,
  sample: CompositionDocument,
): LoadOutcome {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { status: "fresh", document: cloneJson(sample) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: "recovered",
      document: cloneJson(sample),
      reason: "Stored Composition is not valid JSON.",
    };
  }

  const foundSchemaVersion = readSchemaVersion(parsed);
  if (foundSchemaVersion !== null && foundSchemaVersion > COMPOSITION_SCHEMA_VERSION) {
    // Future schema — quarantine without overwrite.
    return {
      status: "quarantined",
      document: cloneJson(sample),
      quarantinedRaw: raw,
      foundSchemaVersion,
    };
  }

  if (!isStructurallyValidDocument(parsed)) {
    return {
      status: "recovered",
      document: cloneJson(sample),
      reason:
        foundSchemaVersion === null
          ? "Stored Composition has no supported schemaVersion."
          : "Stored Composition is malformed under the supported schema.",
    };
  }

  return { status: "ok", document: parsed };
}

/** The explicit reset action — a fresh clone of the native sample. */
export function resetToSample(sample: CompositionDocument): CompositionDocument {
  return cloneJson(sample);
}
