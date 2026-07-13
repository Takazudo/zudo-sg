import { isJsonSafe, isPlainObject } from "../model/json";
import { COMPOSITION_SCHEMA_VERSION } from "../model/types";
import { isStructurallyValidDocument } from "../model/validate";
import type {
  CompositionLoadOutcome,
  CompositionRecord,
  CompositionRecordValidation,
  CompositionRecordValidationIssue,
} from "./types";

/**
 * Lower-case, case-stable ids safe to embed in owned filenames and URL paths.
 * Dots, separators, percent escapes, whitespace, and leading/trailing
 * punctuation are deliberately excluded. IDs are capped to keep filenames
 * portable across providers.
 */
export const COMPOSITION_RECORD_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/;

export function isSafeCompositionRecordId(value: unknown): value is string {
  return typeof value === "string" && COMPOSITION_RECORD_ID_PATTERN.test(value);
}

/** Canonical UTC ISO instant emitted by `Date#toISOString`. */
export function isValidCompositionTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function issue(
  code: CompositionRecordValidationIssue["code"],
  message: string,
  foundSchemaVersion?: number,
): CompositionRecordValidation {
  return { ok: false, issue: { code, message, ...(foundSchemaVersion === undefined ? {} : { foundSchemaVersion }) } };
}

/** Strict provider-boundary validation over the shared document validator. */
export function validateCompositionRecord(value: unknown): CompositionRecordValidation {
  if (!isPlainObject(value)) {
    return issue("invalid-record", "Composition record must be a plain object.");
  }

  if (!isJsonSafe(value)) {
    return issue("not-json-safe", "Composition record contains data that is not JSON-safe.");
  }

  const raw = value as Record<string, unknown>;
  if (!isSafeCompositionRecordId(raw.id)) {
    return issue("unsafe-id", "Composition record id is not a stable path-safe id.");
  }

  if (!isValidCompositionTimestamp(raw.createdAt)) {
    return issue("invalid-created-at", "Composition record createdAt must be a canonical ISO timestamp.");
  }
  if (!isValidCompositionTimestamp(raw.updatedAt)) {
    return issue("invalid-updated-at", "Composition record updatedAt must be a canonical ISO timestamp.");
  }
  if (raw.updatedAt < raw.createdAt) {
    return issue("invalid-timestamp-order", "Composition record updatedAt cannot precede createdAt.");
  }

  if (!isPlainObject(raw.document)) {
    return issue("malformed-document", "Composition record document must be a plain object.");
  }

  const schemaVersion = raw.document.schemaVersion;
  if (
    typeof schemaVersion === "number" &&
    Number.isFinite(schemaVersion) &&
    schemaVersion > COMPOSITION_SCHEMA_VERSION
  ) {
    return issue(
      "future-schema",
      `Composition document schema ${schemaVersion} is newer than supported schema ${COMPOSITION_SCHEMA_VERSION}.`,
      schemaVersion,
    );
  }

  if (!isStructurallyValidDocument(raw.document)) {
    return issue("malformed-document", "Composition document is malformed or uses an unsupported schema.");
  }
  if (raw.document.id !== raw.id) {
    return issue(
      "record-document-id-mismatch",
      "Composition record id must match its document id.",
    );
  }

  return { ok: true, record: value as unknown as CompositionRecord };
}

/** Classifies unknown provider data without mutating or discarding the source. */
export function loadCompositionRecord(value: unknown): CompositionLoadOutcome {
  const result = validateCompositionRecord(value);
  if (result.ok) return { status: "loaded", record: result.record };
  if (result.issue.code === "future-schema") {
    return {
      status: "future-schema",
      foundSchemaVersion: result.issue.foundSchemaVersion!,
      raw: value,
    };
  }
  return { status: "invalid", issue: result.issue, raw: value };
}
