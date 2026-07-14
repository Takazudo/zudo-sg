import {
  COMPOSITION_PROVIDERS,
  CompositionPersistenceError,
  compareCompositionSummariesNewestFirst,
  createCompositionRecord,
  loadCompositionRecord,
  summarizeComposition,
  validateCompositionRecord,
} from "../../library";
import type {
  CompositionInitializationOutcome,
  CompositionDependent,
  CompositionDeleteOutcome,
  CompositionLoadOutcome,
  CompositionPersistenceOperation,
  CompositionProvider,
  CompositionRecord,
  CompositionStore,
  CompositionSummary,
  CompositionUnpublishOutcome,
} from "../../library";
import { createUuidIdFactory } from "../../model/id-factory";
import { cloneJson } from "../../model/json";
import { loadCompositionDocument } from "../../model/recovery";
import { COMPOSITION_SCHEMA_VERSION } from "../../model/types";
import type { CompositionDocument } from "../../model/types";
import { createSampleDocument } from "../../sample/sample-document";
import {
  COMPOSER_DATABASE_NAME,
  COMPOSER_DATABASE_VERSION,
  COMPOSER_META_KEYS,
  COMPOSITIONS_STORE_NAME,
  LEGACY_COMPOSER_STORAGE_KEY,
  META_STORE_NAME,
  UPDATED_AT_INDEX_NAME,
} from "./types";
import type {
  CleanupMeta,
  ComposerMetaRecord,
  IndexedDbCompositionProviderOptions,
  InitializationMeta,
  LegacyComposerStorage,
  MigrationMeta,
} from "./types";

function persistenceError(
  operation: CompositionPersistenceOperation,
  code: ConstructorParameters<typeof CompositionPersistenceError>[1],
  message: string,
  retryable: boolean,
  cause?: unknown,
): CompositionPersistenceError {
  return new CompositionPersistenceError(operation, code, message, retryable, { cause });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException("IndexedDB transaction aborted.", "AbortError"));
    transaction.onerror = () => {
      // `abort` is the terminal event and carries the useful transaction error.
    };
  });
}

function errorName(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || !("name" in value)) return undefined;
  return typeof value.name === "string" ? value.name : undefined;
}

function mapOperationalError(
  operation: CompositionPersistenceOperation,
  mode: IDBTransactionMode,
  error: unknown,
): CompositionPersistenceError {
  if (error instanceof CompositionPersistenceError) return error;
  const aborted = errorName(error) === "AbortError";
  return persistenceError(
    operation,
    aborted ? "transaction-failed" : mode === "readonly" ? "read-failed" : "write-failed",
    aborted
      ? `IndexedDB ${operation} transaction was aborted.`
      : `IndexedDB ${operation} request failed.`,
    true,
    error,
  );
}

function defaultLegacyStorage(): LegacyComposerStorage {
  return globalThis.localStorage;
}

interface OpenConnection {
  db: IDBDatabase;
  invalidated: boolean;
}

class IndexedDbProviderRuntime {
  readonly factory: IDBFactory | null | undefined;
  readonly legacyStorage: () => LegacyComposerStorage;
  readonly idFactory;
  readonly now: () => string;
  connection: OpenConnection | undefined;
  opening: Promise<OpenConnection> | undefined;

  constructor(options: IndexedDbCompositionProviderOptions) {
    this.factory =
      options.idbFactory === undefined
        ? (globalThis as { indexedDB?: IDBFactory }).indexedDB
        : options.idbFactory;
    this.legacyStorage = options.legacyStorage
      ? () => options.legacyStorage!
      : defaultLegacyStorage;
    this.idFactory = options.idFactory ?? createUuidIdFactory();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async open(operation: CompositionPersistenceOperation): Promise<OpenConnection> {
    if (this.connection) {
      if (this.connection.invalidated) {
        throw persistenceError(
          operation,
          "versionchange",
          "Composer storage was closed because another context changed its database version. Retry to reopen it.",
          true,
        );
      }
      return this.connection;
    }
    if (!this.factory) {
      throw persistenceError(
        operation,
        "unavailable",
        "IndexedDB is unavailable in this browser context.",
        true,
      );
    }
    if (!this.opening) this.opening = this.openDatabase();
    try {
      return await this.opening;
    } finally {
      this.opening = undefined;
    }
  }

  prepareRetry(): void {
    if (this.connection?.invalidated) this.connection = undefined;
  }

  private openDatabase(): Promise<OpenConnection> {
    return new Promise<OpenConnection>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory!.open(COMPOSER_DATABASE_NAME, COMPOSER_DATABASE_VERSION);
      } catch (error) {
        reject(
          persistenceError(
            "initialize",
            "unavailable",
            "IndexedDB could not be opened.",
            true,
            error,
          ),
        );
        return;
      }

      let settled = false;
      let upgradeFailure: CompositionPersistenceError | undefined;

      request.onupgradeneeded = (event) => {
        const transaction = request.transaction;
        if (!transaction) {
          upgradeFailure = persistenceError(
            "initialize",
            "transaction-failed",
            "IndexedDB did not provide an upgrade transaction.",
            true,
          );
          return;
        }
        try {
          const abortUpgrade = (error: unknown): void => {
            upgradeFailure =
              error instanceof CompositionPersistenceError
                ? error
                : persistenceError(
                    "initialize",
                    "transaction-failed",
                    "Composer database migration failed; no migration data was committed.",
                    true,
                    error,
                  );
            try {
              transaction.abort();
            } catch {
              // It may already have aborted because a schema request failed.
            }
          };

          if (event.oldVersion === 0) {
            this.initializeFreshDatabase(request.result, transaction);
          } else if (event.oldVersion === 1) {
            this.migrateV1Database(transaction, abortUpgrade);
          } else {
            throw persistenceError(
              "initialize",
              "unsupported-version",
              `Composer database version ${event.oldVersion} cannot be migrated by this build.`,
              false,
            );
          }
        } catch (error) {
          upgradeFailure =
            error instanceof CompositionPersistenceError
              ? error
              : persistenceError(
                  "initialize",
                  "transaction-failed",
                  "Composer database initialization failed.",
                  true,
                  error,
                );
          try {
            transaction.abort();
          } catch {
            // It may already have aborted because a schema request failed.
          }
        }
      };

      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(
          persistenceError(
            "initialize",
            "blocked",
            "Composer storage upgrade is blocked by another open tab. Close or reload the other tab, then retry.",
            true,
          ),
        );
      };

      request.onerror = () => {
        if (settled) return;
        settled = true;
        if (upgradeFailure) {
          reject(upgradeFailure);
          return;
        }
        const error = request.error;
        if (error?.name === "VersionError") {
          reject(
            persistenceError(
              "initialize",
              "unsupported-version",
              "This Composer database was created by a newer unsupported application version.",
              false,
              error,
            ),
          );
          return;
        }
        reject(
          persistenceError(
            "initialize",
            "transaction-failed",
            "Composer database opening or upgrade failed; no migration data was committed.",
            true,
            error,
          ),
        );
      };

      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        settled = true;
        const connection: OpenConnection = { db, invalidated: false };
        db.onversionchange = () => {
          connection.invalidated = true;
          db.close();
        };
        this.connection = connection;
        resolve(connection);
      };
    });
  }

  private initializeFreshDatabase(db: IDBDatabase, transaction: IDBTransaction): void {
    const compositions = db.createObjectStore(COMPOSITIONS_STORE_NAME, { keyPath: "id" });
    compositions.createIndex(UPDATED_AT_INDEX_NAME, "updatedAt", { unique: false });
    const meta = db.createObjectStore(META_STORE_NAME, { keyPath: "key" });

    let raw: string | null;
    try {
      raw = this.legacyStorage().getItem(LEGACY_COMPOSER_STORAGE_KEY);
    } catch (error) {
      throw persistenceError(
        "initialize",
        "read-failed",
        "The existing Composer localStorage document could not be read. Nothing was imported or seeded; retry is safe.",
        true,
        error,
      );
    }

    const initializedAt = this.now();
    meta.put({
      key: COMPOSER_META_KEYS.schema,
      databaseVersion: COMPOSER_DATABASE_VERSION,
      recordSchemaVersion: COMPOSITION_SCHEMA_VERSION,
    } satisfies ComposerMetaRecord);

    if (raw === null) {
      const record = createCompositionRecord(createSampleDocument(), {
        idFactory: this.idFactory,
        now: () => initializedAt,
      });
      assertValidGeneratedRecord(record);
      compositions.add(record);
      meta.put({
        key: COMPOSER_META_KEYS.initialization,
        state: "ready",
        initializedAt,
        recordId: record.id,
      } satisfies InitializationMeta);
      meta.put({ key: COMPOSER_META_KEYS.migration, state: "none" } satisfies MigrationMeta);
      meta.put({ key: COMPOSER_META_KEYS.cleanup, state: "not-needed" } satisfies CleanupMeta);
      return;
    }

    const classified = classifyLegacyDocument(raw);
    if (classified.kind === "future") {
      meta.put({
        key: COMPOSER_META_KEYS.initialization,
        state: "quarantined",
        initializedAt,
      } satisfies InitializationMeta);
      meta.put({
        key: COMPOSER_META_KEYS.migration,
        state: "quarantined",
        foundSchemaVersion: classified.foundSchemaVersion,
        rawBackup: raw,
      } satisfies MigrationMeta);
      meta.put({ key: COMPOSER_META_KEYS.cleanup, state: "retained" } satisfies CleanupMeta);
      return;
    }

    if (classified.kind === "malformed") {
      const record = createCompositionRecord(createSampleDocument(), {
        idFactory: this.idFactory,
        now: () => initializedAt,
      });
      assertValidGeneratedRecord(record);
      compositions.add(record);
      meta.put({
        key: COMPOSER_META_KEYS.initialization,
        state: "recovered",
        initializedAt,
        recordId: record.id,
      } satisfies InitializationMeta);
      meta.put({
        key: COMPOSER_META_KEYS.migration,
        state: "recovered",
        reason: "malformed",
        recordId: record.id,
        rawBackup: raw,
      } satisfies MigrationMeta);
      meta.put({ key: COMPOSER_META_KEYS.cleanup, state: "retained" } satisfies CleanupMeta);
      return;
    }

    const originalId = classified.document.id;
    const safeId = validateCompositionRecordId(originalId)
      ? originalId
      : this.idFactory("composition");
    const document = cloneJson(classified.document);
    document.id = safeId;
    const record: CompositionRecord = {
      id: safeId,
      createdAt: initializedAt,
      updatedAt: initializedAt,
      document,
    };
    assertValidGeneratedRecord(record);
    compositions.add(record);
    meta.put({
      key: COMPOSER_META_KEYS.initialization,
      state: "ready",
      initializedAt,
      recordId: safeId,
    } satisfies InitializationMeta);
    meta.put({
      key: COMPOSER_META_KEYS.migration,
      state: "imported",
      recordId: safeId,
      ...(safeId === originalId ? {} : { originalId }),
    } satisfies MigrationMeta);
    meta.put({
      key: COMPOSER_META_KEYS.cleanup,
      state: "pending",
      snapshot: raw,
      attempts: 0,
    } satisfies CleanupMeta);

    // Keep this parameter live in the method contract: all writes above belong
    // to the one upgrade transaction supplied by IndexedDB.
    void transaction;
  }

  /**
   * Upgrade the v1 physical database without opening a second transaction.
   * Every cursor update and the schema metadata write are part of IndexedDB's
   * version-change transaction, so a malformed/future record or a failed
   * update rolls back every preceding rewrite and leaves the database at v1.
   */
  private migrateV1Database(
    transaction: IDBTransaction,
    abortUpgrade: (error: unknown) => void,
  ): void {
    let compositions: IDBObjectStore;
    let meta: IDBObjectStore;
    try {
      compositions = transaction.objectStore(COMPOSITIONS_STORE_NAME);
      meta = transaction.objectStore(META_STORE_NAME);
    } catch (error) {
      abortUpgrade(
        persistenceError(
          "initialize",
          "transaction-failed",
          "Composer v1 database is missing a required store; the upgrade was aborted without changing stored data.",
          true,
          error,
        ),
      );
      return;
    }

    const updateSchemaMetadata = (): void => {
      let update: IDBRequest<IDBValidKey>;
      try {
        update = meta.put({
          key: COMPOSER_META_KEYS.schema,
          databaseVersion: COMPOSER_DATABASE_VERSION,
          recordSchemaVersion: COMPOSITION_SCHEMA_VERSION,
        } satisfies ComposerMetaRecord);
      } catch (error) {
        abortUpgrade(error);
        return;
      }
      update.onerror = () => abortUpgrade(update.error ?? new Error("Could not update Composer schema metadata."));
    };

    let cursorRequest: IDBRequest<IDBCursorWithValue | null>;
    try {
      cursorRequest = compositions.openCursor();
    } catch (error) {
      abortUpgrade(error);
      return;
    }
    cursorRequest.onerror = () =>
      abortUpgrade(cursorRequest.error ?? new Error("Could not inspect Composer v1 records."));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor === null) {
        updateSchemaMetadata();
        return;
      }

      const loaded = loadCompositionRecord(cursor.value);
      if (loaded.status !== "loaded") {
        abortUpgrade(
          persistenceError(
            "initialize",
            "transaction-failed",
            "Composer database contains malformed or unsupported data. The upgrade was aborted without changing stored data; retry is safe after recovery.",
            true,
          ),
        );
        return;
      }

      if (loaded.decodedFromSchemaVersion === undefined) {
        cursor.continue();
        return;
      }

      let update: IDBRequest<IDBValidKey>;
      try {
        update = cursor.update(loaded.record);
      } catch (error) {
        abortUpgrade(error);
        return;
      }
      update.onerror = () =>
        abortUpgrade(update.error ?? new Error("Could not migrate a Composer v1 record."));
      update.onsuccess = () => cursor.continue();
    };
  }
}

function validateCompositionRecordId(id: string): boolean {
  const document = createSampleDocument();
  document.id = id;
  return validateCompositionRecord({
    id,
    createdAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2000-01-01T00:00:00.000Z",
    document,
  }).ok;
}

function assertValidGeneratedRecord(record: CompositionRecord): void {
  const validation = validateCompositionRecord(record);
  if (!validation.ok) {
    throw persistenceError(
      "initialize",
      "validation",
      `Generated migration record is invalid: ${validation.issue.message}`,
      false,
    );
  }
}

type ClassifiedLegacyDocument =
  | { kind: "valid"; document: CompositionDocument }
  | { kind: "malformed" }
  | { kind: "future"; foundSchemaVersion: number };

function classifyLegacyDocument(raw: string): ClassifiedLegacyDocument {
  // Keep browser-localStorage import on the same decoder/recovery decision as
  // the chrome storage seam. In particular, a valid v1 document is imported
  // as its lossless v2 representation before it enters IndexedDB.
  const outcome = loadCompositionDocument(raw, createSampleDocument());
  if (outcome.status === "ok") return { kind: "valid", document: outcome.document };
  if (outcome.status === "quarantined") {
    return { kind: "future", foundSchemaVersion: outcome.foundSchemaVersion };
  }
  return { kind: "malformed" };
}

function dependentFromRecord(record: CompositionRecord): CompositionDependent | undefined {
  const binding = record.document.binding;
  return binding === undefined
    ? undefined
    : { summary: summarizeComposition(record), binding: cloneJson(binding) };
}

class IndexedDbCompositionStore implements CompositionStore {
  readonly provider = COMPOSITION_PROVIDERS.indexeddb;

  constructor(private readonly runtime: IndexedDbProviderRuntime) {}

  async list(): Promise<readonly CompositionSummary[]> {
    const records = await this.run("list", "readonly", (store) =>
      requestResult(store.getAll()) as Promise<CompositionRecord[]>,
    );
    return records
      .map((raw) => {
        const loaded = loadCompositionRecord(raw);
        if (loaded.status !== "loaded") {
          throw persistenceError(
            "list",
            "validation",
            "Composer storage contains a record that cannot be listed safely.",
            false,
          );
        }
        return summarizeComposition(loaded.record);
      })
      .sort(compareCompositionSummariesNewestFirst);
  }

  async get(id: string): Promise<CompositionLoadOutcome> {
    const raw = await this.run("get", "readonly", (store) => requestResult(store.get(id)));
    return raw === undefined ? { status: "not-found", id } : loadCompositionRecord(raw);
  }

  async put(record: CompositionRecord): Promise<void> {
    const validation = validateCompositionRecord(record);
    if (!validation.ok) {
      throw persistenceError("put", "validation", validation.issue.message, false);
    }
    await this.run("put", "readwrite", async (store) => {
      await this.assertBindingTransition(store, validation.record);
      await requestResult(store.put(validation.record));
    });
  }

  async delete(id: string): Promise<boolean> {
    const outcome = await this.deleteWithDependencyCheck(id);
    return outcome.status === "deleted";
  }

  /**
   * Read the candidate source and every canonical binding in the SAME
   * read-write transaction. IndexedDB's transaction serialization means a
   * consumer inserted by another tab either appears in this scan or waits
   * until this source mutation completes; there is no list-then-delete race.
   */
  async deleteWithDependencyCheck(id: string): Promise<CompositionDeleteOutcome> {
    return this.run("delete", "readwrite", async (store) => {
      const sourceRequest = store.get(id);
      const recordsRequest = store.getAll();
      const [rawSource, rawRecords] = await Promise.all([
        requestResult(sourceRequest),
        requestResult(recordsRequest) as Promise<CompositionRecord[]>,
      ]);
      if (rawSource === undefined) return { status: "not-found" };

      const source = loadCompositionRecord(rawSource);
      if (source.status !== "loaded") {
        throw persistenceError(
          "delete",
          "validation",
          "Composer storage contains a source record that cannot be deleted safely.",
          false,
        );
      }
      if (source.record.document.publication?.kind === "global-template") {
        const dependents = this.dependentsFromRecords(rawRecords, source.record.id);
        if (dependents.length > 0) return { status: "blocked", dependents };
      }
      await requestResult(store.delete(id));
      return { status: "deleted" };
    });
  }

  /**
   * Publication removal follows the same transaction discipline as deletion.
   * Pattern/ordinary records have no consumers, while a Global template is
   * rechecked immediately before the one-record replacement is queued.
   */
  async unpublishWithDependencyCheck(id: string): Promise<CompositionUnpublishOutcome> {
    return this.run("put", "readwrite", async (store) => {
      const sourceRequest = store.get(id);
      const recordsRequest = store.getAll();
      const [rawSource, rawRecords] = await Promise.all([
        requestResult(sourceRequest),
        requestResult(recordsRequest) as Promise<CompositionRecord[]>,
      ]);
      if (rawSource === undefined) return { status: "not-found" };

      const source = loadCompositionRecord(rawSource);
      if (source.status !== "loaded") {
        throw persistenceError(
          "put",
          "validation",
          "Composer storage contains a source record that cannot be unpublished safely.",
          false,
        );
      }
      const publication = source.record.document.publication;
      if (publication === undefined) return { status: "not-published" };
      if (publication.kind === "global-template") {
        const dependents = this.dependentsFromRecords(rawRecords, source.record.id);
        if (dependents.length > 0) return { status: "blocked", dependents };
      }

      const { publication: _publication, ...document } = cloneJson(source.record.document);
      const next: CompositionRecord = {
        ...source.record,
        updatedAt: this.runtime.now(),
        document,
      };
      const validation = validateCompositionRecord(next);
      if (!validation.ok) {
        throw persistenceError("put", "validation", validation.issue.message, false);
      }
      await requestResult(store.put(validation.record));
      return { status: "unpublished" };
    });
  }

  /** IndexedDB commits the one replacement record atomically with its transaction. */
  async saveLifecycleRecord(record: CompositionRecord): Promise<void> {
    await this.put(record);
  }

  async clear(): Promise<void> {
    await this.run("clear", "readwrite", async (store) => {
      const records = await requestResult(store.getAll()) as CompositionRecord[];
      for (const raw of records) {
        const source = loadCompositionRecord(raw);
        if (source.status !== "loaded") {
          throw persistenceError(
            "clear",
            "validation",
            "Composer storage contains a record that cannot be cleared safely.",
            false,
          );
        }
        if (source.record.document.publication?.kind !== "global-template") continue;
        const dependents = this.dependentsFromRecords(records, source.record.id);
        if (dependents.length > 0) {
          throw persistenceError(
            "clear",
            "blocked",
            "Cannot clear Composer storage while a Global template still has bound consumers. Detach or remove bindings individually first.",
            false,
          );
        }
      }
      await requestResult(store.clear());
    });
  }

  private dependentsFromRecords(
    records: readonly CompositionRecord[],
    sourceRecordId: string,
  ): CompositionDependent[] {
    const dependents: CompositionDependent[] = [];
    for (const raw of records) {
      const loaded = loadCompositionRecord(raw);
      if (loaded.status !== "loaded") {
        throw persistenceError(
          "delete",
          "validation",
          "Composer storage contains a record that prevents dependency-safe source mutation.",
          false,
        );
      }
      if (loaded.record.id === sourceRecordId || loaded.record.document.binding?.sourceRecordId !== sourceRecordId) {
        continue;
      }
      const dependent = dependentFromRecord(loaded.record);
      if (dependent) dependents.push(dependent);
    }
    return dependents.sort((a, b) => compareCompositionSummariesNewestFirst(a.summary, b.summary));
  }

  /**
   * A new/changing binding is a relationship creation, not an ordinary draft
   * save. Validate it in the same transaction that writes the consumer so a
   * consumer queued behind a successful source deletion cannot commit an
   * orphan. Existing bindings intentionally remain saveable when their source
   * is externally unavailable; those use the explicit broken-binding flow.
   */
  private async assertBindingTransition(store: IDBObjectStore, next: CompositionRecord): Promise<void> {
    const binding = next.document.binding;
    if (!binding) return;

    const rawPrevious = await requestResult(store.get(next.id));
    if (rawPrevious !== undefined) {
      const previous = loadCompositionRecord(rawPrevious);
      if (previous.status !== "loaded") {
        throw persistenceError(
          "put",
          "validation",
          "Composer storage contains a consumer record that cannot be updated safely.",
          false,
        );
      }
      const priorBinding = previous.record.document.binding;
      if (
        priorBinding?.sourceRecordId === binding.sourceRecordId
        && priorBinding.outletId === binding.outletId
      ) {
        return;
      }
    }

    if (binding.sourceRecordId === next.id) {
      throw persistenceError("put", "conflict", "A Composition cannot bind to itself as a Global template.", false);
    }
    const rawSource = await requestResult(store.get(binding.sourceRecordId));
    if (rawSource === undefined) {
      throw persistenceError(
        "put",
        "conflict",
        "The selected Global template is no longer available. Refresh the template list and try again.",
        true,
      );
    }
    const source = loadCompositionRecord(rawSource);
    if (
      source.status !== "loaded"
      || source.record.document.binding !== undefined
      || source.record.document.publication?.kind !== "global-template"
      || source.record.document.publication.outlet.id !== binding.outletId
    ) {
      throw persistenceError(
        "put",
        "conflict",
        "The selected Global template changed before this consumer could be saved.",
        true,
      );
    }
  }

  private async run<T>(
    operation: CompositionPersistenceOperation,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const connection = await this.runtime.open(operation);
    if (connection.invalidated) {
      throw persistenceError(
        operation,
        "versionchange",
        "Composer storage changed version in another context. Retry to reopen it.",
        true,
      );
    }
    let transaction: IDBTransaction;
    try {
      transaction = connection.db.transaction(COMPOSITIONS_STORE_NAME, mode);
    } catch (error) {
      throw mapOperationalError(operation, mode, error);
    }
    const done = transactionComplete(transaction);
    try {
      const value = await action(transaction.objectStore(COMPOSITIONS_STORE_NAME));
      await done;
      return value;
    } catch (error) {
      void done.catch(() => undefined);
      throw mapOperationalError(operation, mode, error);
    }
  }
}

async function readMeta<T extends ComposerMetaRecord>(
  runtime: IndexedDbProviderRuntime,
  key: T["key"],
): Promise<T> {
  const connection = await runtime.open("initialize");
  let transaction: IDBTransaction;
  try {
    transaction = connection.db.transaction(META_STORE_NAME, "readonly");
  } catch (error) {
    throw mapOperationalError("initialize", "readonly", error);
  }
  const done = transactionComplete(transaction);
  try {
    const result = await requestResult(transaction.objectStore(META_STORE_NAME).get(key));
    await done;
    if (result === undefined) {
      throw persistenceError(
        "initialize",
        "read-failed",
        `Composer database metadata "${key}" is missing.`,
        false,
      );
    }
    return result as T;
  } catch (error) {
    void done.catch(() => undefined);
    throw mapOperationalError("initialize", "readonly", error);
  }
}

async function retryLegacyCleanup(runtime: IndexedDbProviderRuntime): Promise<CleanupMeta> {
  const connection = await runtime.open("initialize");
  const transaction = connection.db.transaction(META_STORE_NAME, "readwrite");
  const done = transactionComplete(transaction);
  try {
    const store = transaction.objectStore(META_STORE_NAME);
    const cleanup = (await requestResult(store.get(COMPOSER_META_KEYS.cleanup))) as
      | CleanupMeta
      | undefined;
    if (!cleanup) {
      throw persistenceError(
        "initialize",
        "read-failed",
        "Composer cleanup metadata is missing.",
        false,
      );
    }
    if (cleanup.state !== "pending" && cleanup.state !== "changed") {
      await done;
      return cleanup;
    }

    const attempts = cleanup.attempts + 1;
    let next: CleanupMeta;
    let current: string | null;
    try {
      current = runtime.legacyStorage().getItem(LEGACY_COMPOSER_STORAGE_KEY);
    } catch {
      next = { ...cleanup, state: "pending", attempts };
      await requestResult(store.put(next));
      await done;
      return next;
    }
    if (current === null) {
      next = {
        key: COMPOSER_META_KEYS.cleanup,
        state: "removed",
        completedAt: runtime.now(),
        attempts,
      };
      await requestResult(store.put(next));
      await done;
      return next;
    }
    if (current !== cleanup.snapshot) {
      next = { ...cleanup, state: "changed", attempts };
      await requestResult(store.put(next));
      await done;
      return next;
    }
    try {
      const storage = runtime.legacyStorage();
      // Re-check synchronously immediately before removal. The IDB write
      // transaction serializes this state machine across Composer tabs.
      if (storage.getItem(LEGACY_COMPOSER_STORAGE_KEY) !== cleanup.snapshot) {
        next = { ...cleanup, state: "changed", attempts };
      } else {
        storage.removeItem(LEGACY_COMPOSER_STORAGE_KEY);
        next =
          storage.getItem(LEGACY_COMPOSER_STORAGE_KEY) === null
            ? {
                key: COMPOSER_META_KEYS.cleanup,
                state: "removed",
                completedAt: runtime.now(),
                attempts,
              }
            : { ...cleanup, state: "changed", attempts };
      }
    } catch {
      next = { ...cleanup, state: "pending", attempts };
    }
    await requestResult(store.put(next));
    await done;
    return next;
  } catch (error) {
    void done.catch(() => undefined);
    throw mapOperationalError("initialize", "readwrite", error);
  }
}

async function outcomeFromMetadata(
  runtime: IndexedDbProviderRuntime,
  store: IndexedDbCompositionStore,
  cleanup: CleanupMeta,
): Promise<CompositionInitializationOutcome> {
  const migration = await readMeta<MigrationMeta>(runtime, COMPOSER_META_KEYS.migration);
  if (migration.state === "quarantined") {
    return {
      status: "recovery-required",
      recovery: {
        kind: "quarantined",
        reason: "future-schema",
        foundSchemaVersion: migration.foundSchemaVersion,
        sourcePreserved: true,
        message: `The legacy Composition uses future schema ${migration.foundSchemaVersion}. It is quarantined unchanged. Start fresh only if you want a separate writable sample.`,
      },
    };
  }

  const summaries = await store.list();
  if (migration.state === "recovered") {
    return {
      status: "ready-with-recovery",
      summaries,
      recovery: {
        kind: "recovered",
        reason: "malformed",
        record: (await requiredRecord(store, migration.recordId)),
        sourcePreserved: true,
        message: "The legacy Composition was malformed. Its exact source and backup were retained; a recovered sample was created. Retry is safe.",
      },
    };
  }

  const unsafeImport =
    migration.state === "imported" && migration.originalId
      ? { originalId: migration.originalId, recordId: migration.recordId }
      : undefined;
  if (cleanup.state === "changed") {
    return {
      status: "ready-with-recovery",
      summaries,
      recovery: {
        kind: "source-changed",
        sourcePreserved: true,
        message: unsafeImport
          ? `Imported legacy id "${unsafeImport.originalId}" under a fresh safe id. The localStorage source then changed, so it was retained.`
          : "The legacy localStorage source changed after import, so cleanup retained it. Retry will only remove the exact imported snapshot.",
      },
    };
  }
  if (cleanup.state === "pending") {
    return {
      status: "ready-with-recovery",
      summaries,
      recovery: {
        kind: "cleanup-pending",
        sourcePreserved: true,
        message: unsafeImport
          ? `Imported legacy id "${unsafeImport.originalId}" under a fresh safe id. Exact-source cleanup is still pending and will retry safely.`
          : "The legacy Composition was imported, but exact-source localStorage cleanup is still pending and will retry safely.",
      },
    };
  }
  if (unsafeImport) {
    return {
      status: "ready-with-recovery",
      summaries,
      recovery: {
        kind: "recovered",
        reason: "unsafe-id",
        record: await requiredRecord(store, unsafeImport.recordId),
        sourcePreserved: true,
        message: `The legacy id "${unsafeImport.originalId}" was unsafe for the new library and was replaced with "${unsafeImport.recordId}".`,
      },
    };
  }
  return { status: "ready", summaries };
}

async function requiredRecord(
  store: IndexedDbCompositionStore,
  id: string,
): Promise<CompositionRecord> {
  const loaded = await store.get(id);
  if (loaded.status !== "loaded") {
    throw persistenceError(
      "initialize",
      "read-failed",
      `Composer initialization record "${id}" is missing or invalid.`,
      false,
    );
  }
  return loaded.record;
}

async function startFreshAfterQuarantine(
  runtime: IndexedDbProviderRuntime,
  store: IndexedDbCompositionStore,
): Promise<CompositionInitializationOutcome> {
  const observedMigration = await readMeta<MigrationMeta>(runtime, COMPOSER_META_KEYS.migration);
  if (observedMigration.state !== "quarantined") {
    const cleanup = await retryLegacyCleanup(runtime);
    return outcomeFromMetadata(runtime, store, cleanup);
  }
  const connection = await runtime.open("initialize");
  const record = createCompositionRecord(createSampleDocument(), {
    idFactory: runtime.idFactory,
    now: runtime.now,
  });
  assertValidGeneratedRecord(record);
  const transaction = connection.db.transaction(
    [COMPOSITIONS_STORE_NAME, META_STORE_NAME],
    "readwrite",
  );
  const done = transactionComplete(transaction);
  try {
    const metaStore = transaction.objectStore(META_STORE_NAME);
    // Re-read under the write lock: another tab may have completed this
    // explicit bypass after our optimistic read above.
    const migration = (await requestResult(
      metaStore.get(COMPOSER_META_KEYS.migration),
    )) as MigrationMeta | undefined;
    if (!migration) {
      throw persistenceError(
        "initialize",
        "read-failed",
        "Composer migration metadata is missing.",
        false,
      );
    }
    if (migration.state !== "quarantined") {
      await done;
      const cleanup = await retryLegacyCleanup(runtime);
      return outcomeFromMetadata(runtime, store, cleanup);
    }
    await requestResult(transaction.objectStore(COMPOSITIONS_STORE_NAME).add(record));
    await requestResult(metaStore.put({
      key: COMPOSER_META_KEYS.initialization,
      state: "bypassed",
      initializedAt: runtime.now(),
      recordId: record.id,
    } satisfies InitializationMeta));
    await requestResult(metaStore.put({
      ...migration,
      state: "bypassed",
      recordId: record.id,
    } satisfies MigrationMeta));
    await done;
  } catch (error) {
    void done.catch(() => undefined);
    throw mapOperationalError("initialize", "readwrite", error);
  }
  return { status: "ready", summaries: await store.list() };
}

/** Creates the normal browser provider with injectable browser storage seams. */
export function createIndexedDbCompositionProvider(
  options: IndexedDbCompositionProviderOptions = {},
): CompositionProvider {
  const runtime = new IndexedDbProviderRuntime(options);
  const store = new IndexedDbCompositionStore(runtime);

  const initialize = async (): Promise<CompositionInitializationOutcome> => {
    try {
      await runtime.open("initialize");
      const cleanup = await retryLegacyCleanup(runtime);
      return await outcomeFromMetadata(runtime, store, cleanup);
    } catch (error) {
      const typed =
        error instanceof CompositionPersistenceError
          ? error
          : persistenceError(
              "initialize",
              "unknown",
              "Composer storage initialization failed.",
              true,
              error,
            );
      return { status: "error", error: typed };
    }
  };

  return {
    descriptor: COMPOSITION_PROVIDERS.indexeddb,
    store,
    initialization: {
      initialize,
      retry: async () => {
        runtime.prepareRetry();
        return initialize();
      },
      startFresh: async () => {
        try {
          await runtime.open("initialize");
          return await startFreshAfterQuarantine(runtime, store);
        } catch (error) {
          return {
            status: "error",
            error:
              error instanceof CompositionPersistenceError
                ? error
                : persistenceError(
                    "initialize",
                    "unknown",
                    "Starting a fresh Composer library failed.",
                    true,
                    error,
                  ),
          };
        }
      },
    },
  };
}
