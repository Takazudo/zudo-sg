// Schema-version dispatch and the lossless v1 → v2 Composition decoder.
//
// This module deliberately does not perform structural validation. Callers
// decode first, then run the current-version validator over the returned
// document. That preserves the distinction between a supported older version,
// malformed data, and data authored by a newer build.

import { isPlainObject } from "./json";
import {
  COMPOSITION_SCHEMA_V1,
  COMPOSITION_SCHEMA_VERSION,
} from "./types";
import type { CompositionDocument, CompositionDocumentV1 } from "./types";

export type CompositionDocumentDecodeOutcome =
  | { status: "current"; document: unknown }
  | { status: "decoded"; document: unknown; sourceSchemaVersion: typeof COMPOSITION_SCHEMA_V1 }
  | { status: "future-schema"; foundSchemaVersion: number }
  | { status: "malformed" };

/**
 * Pure v1 upgrade. It deliberately changes only the schema version: both v2
 * reuse fields are optional, so leaving them absent is the lossless canonical
 * representation of an ordinary v1 Composition.
 */
export function decodeCompositionDocumentV1(document: CompositionDocumentV1): CompositionDocument {
  return { ...document, schemaVersion: COMPOSITION_SCHEMA_VERSION };
}

/**
 * Route one untrusted persisted value to the supported current version without
 * mutating it. The decoded branch must still pass `isStructurallyValidDocument`
 * before it is treated as a usable CompositionDocument.
 */
export function decodeCompositionDocument(value: unknown): CompositionDocumentDecodeOutcome {
  if (!isPlainObject(value)) return { status: "malformed" };

  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    return { status: "malformed" };
  }

  if (schemaVersion === COMPOSITION_SCHEMA_VERSION) {
    return { status: "current", document: value };
  }
  if (schemaVersion === COMPOSITION_SCHEMA_V1) {
    return {
      status: "decoded",
      document: decodeCompositionDocumentV1(value as unknown as CompositionDocumentV1),
      sourceSchemaVersion: COMPOSITION_SCHEMA_V1,
    };
  }
  if (schemaVersion > COMPOSITION_SCHEMA_VERSION) {
    return { status: "future-schema", foundSchemaVersion: schemaVersion };
  }

  return { status: "malformed" };
}
