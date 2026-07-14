// Storage recovery + schema decoding + future-schema quarantine.
//
// Loading persisted Composition storage has three interesting failure modes,
// each handled WITHOUT destroying user data:
//
//  - VALID V1 → decode losslessly to v2 before current-version structural
//    validation. The caller can use `decodedFromSchemaVersion` to decide when
//    its persistence boundary should safely rewrite the source.
//  - MALFORMED (unparseable, wrong shape, duplicate ids, non-JSON props) under a
//    supported schema version → recover to the native production sample.
//  - FUTURE schema (a numeric `schemaVersion` newer than this build supports) →
//    QUARANTINE: surface the sample to work in, but keep the raw storage
//    untouched (`quarantinedRaw`) so a newer build can still read it. Reset is
//    explicit — only an explicit `resetToSample` overwrites quarantined data.
//  - EMPTY (nothing stored yet) → a fresh copy of the sample.
//
// The model only REPORTS the outcome; the persistence layer (wave-3 / #247)
// decides whether to write. A `quarantined` outcome must NOT be written back.

import type { CompositionDocument } from "./types";
import { cloneJson, isPlainObject } from "./json";
import { decodeCompositionDocument } from "./codec";
import { isStructurallyValidDocument } from "./validate";

export type LoadOutcome =
  | { status: "fresh"; document: CompositionDocument }
  | { status: "ok"; document: CompositionDocument; decodedFromSchemaVersion?: 1 }
  | { status: "recovered"; document: CompositionDocument; reason: string }
  | {
      status: "quarantined";
      document: CompositionDocument;
      quarantinedRaw: string;
      foundSchemaVersion: number;
    };

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

  const decoded = decodeCompositionDocument(parsed);
  if (decoded.status === "future-schema") {
    // Future schema — quarantine without overwrite.
    return {
      status: "quarantined",
      document: cloneJson(sample),
      quarantinedRaw: raw,
      foundSchemaVersion: decoded.foundSchemaVersion,
    };
  }

  if (decoded.status === "malformed" || !isStructurallyValidDocument(decoded.document)) {
    return {
      status: "recovered",
      document: cloneJson(sample),
      reason:
        !isPlainObject(parsed) || typeof parsed.schemaVersion !== "number"
          ? "Stored Composition has no supported schemaVersion."
          : "Stored Composition is malformed under the supported schema.",
    };
  }

  return {
    status: "ok",
    document: decoded.document,
    ...(decoded.status === "decoded" ? { decodedFromSchemaVersion: decoded.sourceSchemaVersion } : {}),
  };
}

/** The explicit reset action — a fresh clone of the native sample. */
export function resetToSample(sample: CompositionDocument): CompositionDocument {
  return cloneJson(sample);
}
