import type { CompositionDocument } from "../model/types";

/** A persisted composition and its storage metadata. */
export interface CompositionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  document: CompositionDocument;
}

/** The inexpensive representation returned by collection listings. */
export interface CompositionSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
}

export const COMPOSITION_PROVIDER_IDS = {
  indexeddb: "indexeddb",
  files: "files",
} as const;

export type CompositionProviderId =
  (typeof COMPOSITION_PROVIDER_IDS)[keyof typeof COMPOSITION_PROVIDER_IDS];

export interface CompositionProviderDescriptor {
  id: CompositionProviderId;
  label: string;
  /** Human-readable identity for diagnostics and storage inspection. */
  storageLabel: string;
}

export const COMPOSITION_PROVIDERS = {
  indexeddb: {
    id: COMPOSITION_PROVIDER_IDS.indexeddb,
    label: "Browser storage",
    storageLabel: "IndexedDB: zudo-sg-composer",
  },
  files: {
    id: COMPOSITION_PROVIDER_IDS.files,
    label: "Local files",
    storageLabel: "Development composition files",
  },
} as const satisfies Record<CompositionProviderId, CompositionProviderDescriptor>;

/** A provider-qualified identity. Record ids are unique only inside a provider. */
export interface CompositionRecordRef {
  providerId: CompositionProviderId;
  recordId: string;
}

export type CompositionRecordValidationCode =
  | "invalid-record"
  | "unsafe-id"
  | "record-document-id-mismatch"
  | "invalid-created-at"
  | "invalid-updated-at"
  | "invalid-timestamp-order"
  | "not-json-safe"
  | "malformed-document"
  | "future-schema";

export interface CompositionRecordValidationIssue {
  code: CompositionRecordValidationCode;
  message: string;
  foundSchemaVersion?: number;
}

export type CompositionRecordValidation =
  | { ok: true; record: CompositionRecord }
  | { ok: false; issue: CompositionRecordValidationIssue };

/** Result of decoding provider data. Storage failures are represented separately. */
export type CompositionLoadOutcome =
  | { status: "loaded"; record: CompositionRecord }
  | { status: "not-found"; id: string }
  | { status: "invalid"; issue: CompositionRecordValidationIssue; raw: unknown }
  | {
      status: "future-schema";
      foundSchemaVersion: number;
      raw: unknown;
    };

export type CompositionPersistenceOperation =
  | "initialize"
  | "list"
  | "get"
  | "put"
  | "delete"
  | "clear";

export type CompositionPersistenceErrorCode =
  | "unavailable"
  | "blocked"
  | "unsupported-version"
  | "validation"
  | "read-failed"
  | "write-failed"
  | "transaction-failed"
  | "conflict"
  | "unknown";

/** Provider-neutral error used for rejected store/initialization promises. */
export class CompositionPersistenceError extends Error {
  readonly name = "CompositionPersistenceError";

  constructor(
    readonly operation: CompositionPersistenceOperation,
    readonly code: CompositionPersistenceErrorCode,
    message: string,
    readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/**
 * Minimal async collection contract. Implementations must validate records at
 * their boundary and reject operational failures with
 * `CompositionPersistenceError`.
 */
export interface CompositionStore {
  readonly provider: CompositionProviderDescriptor;
  list(): Promise<readonly CompositionSummary[]>;
  get(id: string): Promise<CompositionLoadOutcome>;
  put(record: CompositionRecord): Promise<void>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

export type CompositionRecoveryOutcome =
  | {
      kind: "recovered";
      reason: "malformed" | "unsafe-id";
      record: CompositionRecord;
      sourcePreserved: true;
      message: string;
    }
  | {
      kind: "quarantined";
      reason: "future-schema";
      foundSchemaVersion: number;
      sourcePreserved: true;
      message: string;
    }
  | {
      kind: "cleanup-pending" | "source-changed";
      sourcePreserved: true;
      message: string;
    };

export type CompositionInitializationOutcome =
  | { status: "ready"; summaries: readonly CompositionSummary[] }
  | {
      status: "ready-with-recovery";
      summaries: readonly CompositionSummary[];
      recovery: Extract<CompositionRecoveryOutcome, { kind: "recovered" | "cleanup-pending" | "source-changed" }>;
    }
  | {
      status: "recovery-required";
      recovery: Extract<CompositionRecoveryOutcome, { kind: "quarantined" }>;
    }
  | { status: "error"; error: CompositionPersistenceError };

/**
 * Explicit provider-level recovery actions. `startFresh` is intentionally
 * separate from `initialize`/`retry`; implementations must preserve the source
 * or its exact backup before creating replacement data.
 */
export interface CompositionProviderInitializer {
  initialize(): Promise<CompositionInitializationOutcome>;
  retry(): Promise<CompositionInitializationOutcome>;
  startFresh(): Promise<CompositionInitializationOutcome>;
}

export interface CompositionProvider {
  descriptor: CompositionProviderDescriptor;
  store: CompositionStore;
  initialization: CompositionProviderInitializer;
}
