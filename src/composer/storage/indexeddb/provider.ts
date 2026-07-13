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
  CompositionLoadOutcome,
  CompositionPersistenceOperation,
  CompositionProvider,
  CompositionRecord,
  CompositionStore,
  CompositionSummary,
} from "../../library";
import { createUuidIdFactory } from "../../model/id-factory";
import { cloneJson, isPlainObject } from "../../model/json";
import { COMPOSITION_SCHEMA_VERSION } from "../../model/types";
import type { CompositionDocument } from "../../model/types";
import { isStructurallyValidDocument } from "../../model/validate";
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

      request.onupgradeneeded = () => {
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
          this.initializeFreshDatabase(request.result, transaction);
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "malformed" };
  }
  if (isPlainObject(parsed)) {
    const version = parsed.schemaVersion;
    if (
      typeof version === "number" &&
      Number.isFinite(version) &&
      version > COMPOSITION_SCHEMA_VERSION
    ) {
      return { kind: "future", foundSchemaVersion: version };
    }
  }
  return isStructurallyValidDocument(parsed)
    ? { kind: "valid", document: parsed }
    : { kind: "malformed" };
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
      await requestResult(store.put(record));
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.run("delete", "readwrite", async (store) => {
      const existing = await requestResult(store.getKey(id));
      if (existing === undefined) return false;
      await requestResult(store.delete(id));
      return true;
    });
  }

  async clear(): Promise<void> {
    await this.run("clear", "readwrite", async (store) => {
      await requestResult(store.clear());
    });
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
