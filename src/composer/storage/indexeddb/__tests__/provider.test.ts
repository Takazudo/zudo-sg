import { IDBFactory as FDBFactory, IDBObjectStore as FDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPOSER_DATABASE_NAME,
  COMPOSER_DATABASE_VERSION,
  COMPOSER_META_KEYS,
  COMPOSITIONS_STORE_NAME,
  LEGACY_COMPOSER_STORAGE_KEY,
  META_STORE_NAME,
  CompositionPersistenceError,
  COMPOSITION_SCHEMA_V1,
  COMPOSITION_SCHEMA_VERSION,
  createIndexedDbCompositionProvider,
  createSampleDocument,
} from "../../../index";
import type {
  CleanupMeta,
  ComposerMetaRecord,
  CompositionRecord,
  IndexedDbCompositionProviderOptions,
  LegacyComposerStorage,
  MigrationMeta,
} from "../../../index";

const T1 = "2026-01-02T03:04:05.000Z";
const T2 = "2026-01-02T04:04:05.000Z";

class MemoryLegacyStorage implements LegacyComposerStorage {
  value: string | null;
  getError = false;
  removeError = false;

  constructor(value: string | null) {
    this.value = value;
  }

  getItem(key: string): string | null {
    expect(key).toBe(LEGACY_COMPOSER_STORAGE_KEY);
    if (this.getError) throw new Error("get denied");
    return this.value;
  }

  removeItem(key: string): void {
    expect(key).toBe(LEGACY_COMPOSER_STORAGE_KEY);
    if (this.removeError) throw new Error("remove denied");
    this.value = null;
  }
}

function sequentialIds(): IndexedDbCompositionProviderOptions["idFactory"] {
  let count = 0;
  return () => `composition-${++count}`;
}

function record(id: string, updatedAt = T1): CompositionRecord {
  const document = createSampleDocument();
  document.id = id;
  document.name = `Name ${id}`;
  return { id, createdAt: T1, updatedAt, document };
}

function legacyDocument(id = "legacy-safe"): string {
  const document = createSampleDocument();
  document.id = id;
  document.name = "Legacy document";
  return JSON.stringify({ ...document, schemaVersion: COMPOSITION_SCHEMA_V1 });
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

async function inspectDatabase(factory: IDBFactory): Promise<{
  records: CompositionRecord[];
  meta: ComposerMetaRecord[];
}> {
  const open = factory.open(COMPOSER_DATABASE_NAME, COMPOSER_DATABASE_VERSION);
  const db = await request(open);
  const tx = db.transaction([COMPOSITIONS_STORE_NAME, META_STORE_NAME], "readonly");
  const recordsPromise = request(tx.objectStore(COMPOSITIONS_STORE_NAME).getAll());
  const metaPromise = request(tx.objectStore(META_STORE_NAME).getAll());
  const [records, meta] = await Promise.all([recordsPromise, metaPromise]);
  db.close();
  return { records: records as CompositionRecord[], meta: meta as ComposerMetaRecord[] };
}

function metaRecord<T extends ComposerMetaRecord>(records: ComposerMetaRecord[], key: T["key"]): T {
  const found = records.find((item) => item.key === key);
  expect(found).toBeDefined();
  return found as T;
}

async function openAtVersion(factory: IDBFactory, version: number): Promise<IDBDatabase> {
  return request(factory.open(COMPOSER_DATABASE_NAME, version));
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}

function legacyRecord(id: string, updatedAt = T1): unknown {
  const current = record(id, updatedAt);
  return {
    ...current,
    document: { ...current.document, schemaVersion: COMPOSITION_SCHEMA_V1 },
  };
}

function legacyRecordWithDocument(id: string, document: unknown): unknown {
  return { ...(legacyRecord(id) as Record<string, unknown>), document };
}

async function seedV1Database(factory: IDBFactory, records: readonly unknown[]): Promise<void> {
  const open = factory.open(COMPOSER_DATABASE_NAME, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    const compositions = db.createObjectStore(COMPOSITIONS_STORE_NAME, { keyPath: "id" });
    compositions.createIndex("updatedAt", "updatedAt", { unique: false });
    db.createObjectStore(META_STORE_NAME, { keyPath: "key" });
  };
  const db = await request(open);
  const transaction = db.transaction([COMPOSITIONS_STORE_NAME, META_STORE_NAME], "readwrite");
  const compositions = transaction.objectStore(COMPOSITIONS_STORE_NAME);
  for (const value of records) compositions.put(value);
  transaction.objectStore(META_STORE_NAME).put({
    key: COMPOSER_META_KEYS.schema,
    databaseVersion: 1,
    recordSchemaVersion: COMPOSITION_SCHEMA_V1,
  });
  transaction.objectStore(META_STORE_NAME).put({ key: COMPOSER_META_KEYS.migration, state: "none" });
  transaction.objectStore(META_STORE_NAME).put({ key: COMPOSER_META_KEYS.cleanup, state: "not-needed" });
  transaction.objectStore(META_STORE_NAME).put({
    key: COMPOSER_META_KEYS.initialization,
    state: "ready",
    initializedAt: T1,
  });
  await transactionComplete(transaction);
  db.close();
}

async function inspectV1Database(factory: IDBFactory): Promise<{
  records: unknown[];
  meta: unknown[];
}> {
  const db = await openAtVersion(factory, 1);
  const transaction = db.transaction([COMPOSITIONS_STORE_NAME, META_STORE_NAME], "readonly");
  const records = await request(transaction.objectStore(COMPOSITIONS_STORE_NAME).getAll());
  const meta = await request(transaction.objectStore(META_STORE_NAME).getAll());
  db.close();
  return { records, meta };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IndexedDB composition CRUD", () => {
  it("creates the schema and sample once, supports CRUD, and orders summaries deterministically", async () => {
    const factory = new FDBFactory();
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(null),
      idFactory: sequentialIds(),
      now: () => T1,
    });

    expect(await provider.initialization.initialize()).toMatchObject({
      status: "ready",
      summaries: [{ id: "composition-1" }],
    });
    const inspected = await inspectDatabase(factory);
    expect(inspected.records).toHaveLength(1);
    expect(inspected.records[0]).toMatchObject({
      id: "composition-1",
      document: { schemaVersion: COMPOSITION_SCHEMA_VERSION, id: "composition-1" },
    });
    expect(metaRecord(inspected.meta, COMPOSER_META_KEYS.schema)).toMatchObject({
      databaseVersion: COMPOSER_DATABASE_VERSION,
      recordSchemaVersion: COMPOSITION_SCHEMA_VERSION,
    });
    expect(metaRecord(inspected.meta, COMPOSER_META_KEYS.migration)).toEqual({
      key: "migration",
      state: "none",
    });
    const schemaDb = await openAtVersion(factory, COMPOSER_DATABASE_VERSION);
    const schemaTx = schemaDb.transaction(COMPOSITIONS_STORE_NAME, "readonly");
    const schemaStore = schemaTx.objectStore(COMPOSITIONS_STORE_NAME);
    expect(schemaStore.keyPath).toBe("id");
    expect(schemaStore.indexNames.contains("updatedAt")).toBe(true);
    expect(schemaStore.index("updatedAt").unique).toBe(false);
    schemaDb.close();

    await provider.store.put(record("z", T2));
    await provider.store.put(record("a", T2));
    await provider.store.put(record("older", T1));
    expect((await provider.store.list()).map((summary) => summary.id)).toEqual([
      "a",
      "z",
      "composition-1",
      "older",
    ]);
    expect(await provider.store.get("a")).toMatchObject({ status: "loaded", record: { id: "a" } });
    expect(await provider.store.get("missing")).toEqual({ status: "not-found", id: "missing" });
    expect(await provider.store.delete("a")).toBe(true);
    expect(await provider.store.delete("a")).toBe(false);
  });

  it("validates writes and exposes invalid records read directly from the database", async () => {
    const factory = new FDBFactory();
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(null),
      idFactory: sequentialIds(),
      now: () => T1,
    });
    await provider.initialization.initialize();

    await expect(provider.store.put(record("Unsafe/ID"))).rejects.toMatchObject({
      name: "CompositionPersistenceError",
      operation: "put",
      code: "validation",
      retryable: false,
    });

    const db = await openAtVersion(factory, COMPOSER_DATABASE_VERSION);
    const tx = db.transaction(COMPOSITIONS_STORE_NAME, "readwrite");
    await request(tx.objectStore(COMPOSITIONS_STORE_NAME).put({
      ...record("corrupt"),
      document: { schemaVersion: 1, id: "corrupt", name: "bad", root: "bad" },
    }));
    db.close();
    expect(await provider.store.get("corrupt")).toMatchObject({
      status: "invalid",
      issue: { code: "malformed-document" },
    });
    await expect(provider.store.list()).rejects.toMatchObject({ code: "validation" });
  });

  it("maps request failures and transaction aborts to actionable typed errors", async () => {
    const factory = new FDBFactory();
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(null),
      idFactory: sequentialIds(),
      now: () => T1,
    });
    await provider.initialization.initialize();

    await expect(provider.store.get({} as unknown as string)).rejects.toMatchObject({
      operation: "get",
      code: "read-failed",
      retryable: true,
    });

    const originalClear = FDBObjectStore.prototype.clear;
    vi.spyOn(FDBObjectStore.prototype, "clear").mockImplementationOnce(function (this: IDBObjectStore) {
      const clearRequest = originalClear.call(this);
      this.transaction.abort();
      return clearRequest;
    });
    await expect(provider.store.clear()).rejects.toMatchObject({
      operation: "clear",
      code: "transaction-failed",
      retryable: true,
    });
  });

  it("clear removes only compositions and never reseeds on reload", async () => {
    const factory = new FDBFactory();
    const storage = new MemoryLegacyStorage(null);
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    await provider.initialization.initialize();
    await provider.store.clear();
    expect(await provider.store.list()).toEqual([]);
    expect(await provider.initialization.initialize()).toEqual({ status: "ready", summaries: [] });
    const inspected = await inspectDatabase(factory);
    expect(inspected.records).toEqual([]);
    expect(inspected.meta).toHaveLength(4);
  });
});

describe("IndexedDB v1 → v2 migration", () => {
  it("losslessly upgrades every valid v1 record and schema metadata in one version-change transaction", async () => {
    const factory = new FDBFactory();
    await seedV1Database(factory, [legacyRecord("legacy-a", T1), legacyRecord("legacy-b", T2)]);

    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(null),
      idFactory: sequentialIds(),
      now: () => T2,
    });
    expect(await provider.initialization.initialize()).toMatchObject({
      status: "ready",
      summaries: [{ id: "legacy-b" }, { id: "legacy-a" }],
    });

    const inspected = await inspectDatabase(factory);
    expect(inspected.records).toEqual([
      expect.objectContaining({
        id: "legacy-a",
        createdAt: T1,
        updatedAt: T1,
        document: expect.objectContaining({ schemaVersion: COMPOSITION_SCHEMA_VERSION, id: "legacy-a" }),
      }),
      expect.objectContaining({
        id: "legacy-b",
        createdAt: T1,
        updatedAt: T2,
        document: expect.objectContaining({ schemaVersion: COMPOSITION_SCHEMA_VERSION, id: "legacy-b" }),
      }),
    ]);
    expect(metaRecord(inspected.meta, COMPOSER_META_KEYS.schema)).toMatchObject({
      databaseVersion: COMPOSER_DATABASE_VERSION,
      recordSchemaVersion: COMPOSITION_SCHEMA_VERSION,
    });
  });

  it.each([
    [
      "malformed",
      legacyRecordWithDocument("z-bad", {
        schemaVersion: COMPOSITION_SCHEMA_V1,
        id: "z-bad",
        name: "Bad",
        root: {},
      }),
    ],
    [
      "future",
      legacyRecordWithDocument("z-future", {
        schemaVersion: COMPOSITION_SCHEMA_VERSION + 1,
        id: "z-future",
        name: "Future",
        root: [],
      }),
    ],
  ])("aborts a %s v1 upgrade without changing any record or database version", async (_kind, badRecord) => {
    const factory = new FDBFactory();
    await seedV1Database(factory, [legacyRecord("a-valid"), badRecord]);
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(null),
    });

    expect(await provider.initialization.initialize()).toMatchObject({
      status: "error",
      error: { code: "transaction-failed", retryable: true },
    });
    const inspected = await inspectV1Database(factory);
    expect(inspected.records).toHaveLength(2);
    expect(inspected.records).toEqual(expect.arrayContaining([legacyRecord("a-valid"), badRecord]));
    expect(inspected.meta).toContainEqual({
      key: COMPOSER_META_KEYS.schema,
      databaseVersion: 1,
      recordSchemaVersion: COMPOSITION_SCHEMA_V1,
    });
  });

  it("rolls back earlier cursor rewrites when an upgrade write fails", async () => {
    const factory = new FDBFactory();
    const before = legacyRecord("valid");
    await seedV1Database(factory, [before]);
    vi.spyOn(FDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("synthetic metadata write failure", "AbortError");
    });
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(null),
    });

    expect(await provider.initialization.initialize()).toMatchObject({
      status: "error",
      error: { code: "transaction-failed", retryable: true },
    });
    expect((await inspectV1Database(factory)).records).toEqual([before]);
  });
});

describe("one-time localStorage migration", () => {
  it("imports a valid supported document and discards only its cleanup snapshot", async () => {
    const factory = new FDBFactory();
    const raw = legacyDocument();
    const storage = new MemoryLegacyStorage(raw);
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    expect(await provider.initialization.initialize()).toMatchObject({
      status: "ready",
      summaries: [{ id: "legacy-safe", name: "Legacy document" }],
    });
    expect(storage.value).toBeNull();
    const inspected = await inspectDatabase(factory);
    expect(metaRecord<MigrationMeta>(inspected.meta, COMPOSER_META_KEYS.migration)).toEqual({
      key: "migration",
      state: "imported",
      recordId: "legacy-safe",
    });
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup)).toMatchObject({
      state: "removed",
      attempts: 1,
    });
    expect(inspected.records).toEqual([
      expect.objectContaining({
        id: "legacy-safe",
        document: expect.objectContaining({ schemaVersion: COMPOSITION_SCHEMA_VERSION }),
      }),
    ]);
    expect(JSON.stringify(inspected.meta)).not.toContain(raw);
  });

  it("rekeys an old-model-safe but record-unsafe id and exposes the original id", async () => {
    const factory = new FDBFactory();
    const raw = legacyDocument("Old ID/with slash");
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(raw),
      idFactory: sequentialIds(),
      now: () => T1,
    });
    const outcome = await provider.initialization.initialize();
    expect(outcome).toMatchObject({
      status: "ready-with-recovery",
      recovery: {
        kind: "recovered",
        reason: "unsafe-id",
        record: { id: "composition-1", document: { id: "composition-1" } },
      },
    });
    expect(outcome.status === "ready-with-recovery" && outcome.recovery.message).toContain(
      "Old ID/with slash",
    );
    const inspected = await inspectDatabase(factory);
    expect(metaRecord<MigrationMeta>(inspected.meta, COMPOSER_META_KEYS.migration)).toEqual({
      key: "migration",
      state: "imported",
      recordId: "composition-1",
      originalId: "Old ID/with slash",
    });
  });

  it.each([
    ["malformed JSON", "{broken"],
    ["invalid structure", JSON.stringify({ schemaVersion: 1, id: "x", name: "X", root: {} })],
  ])("retains exact source and backup for %s while creating one recovered sample", async (_label, raw) => {
    const factory = new FDBFactory();
    const storage = new MemoryLegacyStorage(raw);
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    expect(await provider.initialization.initialize()).toMatchObject({
      status: "ready-with-recovery",
      recovery: { kind: "recovered", reason: "malformed", sourcePreserved: true },
      summaries: [{ id: "composition-1" }],
    });
    expect(storage.value).toBe(raw);
    expect(await provider.initialization.retry()).toMatchObject({
      status: "ready-with-recovery",
      summaries: [{ id: "composition-1" }],
    });
    const inspected = await inspectDatabase(factory);
    expect(inspected.records).toHaveLength(1);
    expect(metaRecord<MigrationMeta>(inspected.meta, COMPOSER_META_KEYS.migration)).toMatchObject({
      state: "recovered",
      rawBackup: raw,
    });
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup)).toEqual({
      key: "cleanup",
      state: "retained",
    });
  });

  it("quarantines a future schema and records an explicit start-fresh bypass without deleting it", async () => {
    const factory = new FDBFactory();
    const raw = JSON.stringify({
      schemaVersion: COMPOSITION_SCHEMA_VERSION + 1,
      id: "future",
      name: "Future",
      root: [],
      precious: true,
    });
    const storage = new MemoryLegacyStorage(raw);
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    expect(await provider.initialization.initialize()).toMatchObject({
      status: "recovery-required",
      recovery: {
        kind: "quarantined",
        foundSchemaVersion: COMPOSITION_SCHEMA_VERSION + 1,
        sourcePreserved: true,
      },
    });
    expect((await inspectDatabase(factory)).records).toEqual([]);

    expect(await provider.initialization.startFresh()).toMatchObject({
      status: "ready",
      summaries: [{ id: "composition-1" }],
    });
    expect(storage.value).toBe(raw);
    const inspected = await inspectDatabase(factory);
    expect(metaRecord<MigrationMeta>(inspected.meta, COMPOSER_META_KEYS.migration)).toEqual({
      key: "migration",
      state: "bypassed",
      foundSchemaVersion: COMPOSITION_SCHEMA_VERSION + 1,
      rawBackup: raw,
      recordId: "composition-1",
    });
  });

  it("aborts the fresh upgrade when localStorage read throws, then retries without partial state", async () => {
    const factory = new FDBFactory();
    const storage = new MemoryLegacyStorage(legacyDocument());
    storage.getError = true;
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    expect(await provider.initialization.initialize()).toMatchObject({
      status: "error",
      error: { code: "read-failed", retryable: true },
    });
    expect(storage.value).not.toBeNull();

    storage.getError = false;
    expect(await provider.initialization.retry()).toMatchObject({
      status: "ready",
      summaries: [{ id: "legacy-safe" }],
    });
  });

  it("serializes concurrent first opens so only one initialization result is committed", async () => {
    const factory = new FDBFactory();
    const storage = new MemoryLegacyStorage(null);
    let generated = 0;
    const options = {
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: () => `composition-${++generated}`,
      now: () => T1,
    };
    const a = createIndexedDbCompositionProvider(options);
    const b = createIndexedDbCompositionProvider(options);
    const [outcomeA, outcomeB] = await Promise.all([
      a.initialization.initialize(),
      b.initialization.initialize(),
    ]);
    expect(outcomeA).toMatchObject({ status: "ready", summaries: [{ id: "composition-1" }] });
    expect(outcomeB).toMatchObject({ status: "ready", summaries: [{ id: "composition-1" }] });
    expect(generated).toBe(1);
    expect((await inspectDatabase(factory)).records).toHaveLength(1);
  });

  it("serializes concurrent start-fresh actions after future-schema quarantine", async () => {
    const factory = new FDBFactory();
    const raw = JSON.stringify({
      schemaVersion: COMPOSITION_SCHEMA_VERSION + 1,
      id: "future",
      name: "Future",
      root: [],
    });
    const storage = new MemoryLegacyStorage(raw);
    let generated = 0;
    const options = {
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: () => `composition-${++generated}`,
      now: () => T1,
    };
    const a = createIndexedDbCompositionProvider(options);
    const b = createIndexedDbCompositionProvider(options);
    await a.initialization.initialize();
    const [outcomeA, outcomeB] = await Promise.all([
      a.initialization.startFresh(),
      b.initialization.startFresh(),
    ]);
    expect(outcomeA).toMatchObject({ status: "ready", summaries: [{ id: "composition-1" }] });
    expect(outcomeB).toMatchObject({ status: "ready", summaries: [{ id: "composition-1" }] });
    expect((await inspectDatabase(factory)).records).toHaveLength(1);
    expect(storage.value).toBe(raw);
  });
});

describe("truthful post-commit cleanup", () => {
  it("leaves cleanup pending after removal exception and completes it on a later open", async () => {
    const factory = new FDBFactory();
    const raw = legacyDocument();
    const storage = new MemoryLegacyStorage(raw);
    storage.removeError = true;
    const options = {
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    };
    const first = createIndexedDbCompositionProvider(options);
    expect(await first.initialization.initialize()).toMatchObject({
      status: "ready-with-recovery",
      recovery: { kind: "cleanup-pending" },
    });
    expect(storage.value).toBe(raw);
    let inspected = await inspectDatabase(factory);
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup)).toMatchObject({
      state: "pending",
      snapshot: raw,
    });

    storage.removeError = false;
    const reopened = createIndexedDbCompositionProvider(options);
    expect(await reopened.initialization.initialize()).toMatchObject({ status: "ready" });
    expect(storage.value).toBeNull();
    inspected = await inspectDatabase(factory);
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup).state).toBe("removed");
  });

  it("retains a concurrently changed source and removes it only if it returns to the exact snapshot", async () => {
    const factory = new FDBFactory();
    const raw = legacyDocument();
    const storage = new MemoryLegacyStorage(raw);
    let reads = 0;
    const originalGet = storage.getItem.bind(storage);
    storage.getItem = (key) => {
      reads += 1;
      if (reads === 2) storage.value = "changed-by-another-tab";
      return originalGet(key);
    };
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    expect(await provider.initialization.initialize()).toMatchObject({
      status: "ready-with-recovery",
      recovery: { kind: "source-changed" },
    });
    expect(storage.value).toBe("changed-by-another-tab");
    let inspected = await inspectDatabase(factory);
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup)).toMatchObject({
      state: "changed",
      snapshot: raw,
    });

    storage.value = raw;
    expect(await provider.initialization.retry()).toMatchObject({ status: "ready" });
    expect(storage.value).toBeNull();
    inspected = await inspectDatabase(factory);
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup).state).toBe("removed");
  });

  it("treats an already absent imported source as verified idempotent cleanup", async () => {
    const factory = new FDBFactory();
    const raw = legacyDocument();
    const storage = new MemoryLegacyStorage(raw);
    let reads = 0;
    const originalGet = storage.getItem.bind(storage);
    storage.getItem = (key) => (++reads === 1 ? originalGet(key) : null);
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    expect(await provider.initialization.initialize()).toMatchObject({ status: "ready" });
    const inspected = await inspectDatabase(factory);
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup).state).toBe("removed");
  });

  it("serializes cleanup retries across tabs without regressing completed metadata", async () => {
    const factory = new FDBFactory();
    const raw = legacyDocument();
    const storage = new MemoryLegacyStorage(raw);
    const options = {
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    };
    const a = createIndexedDbCompositionProvider(options);
    const b = createIndexedDbCompositionProvider(options);
    const [outcomeA, outcomeB] = await Promise.all([
      a.initialization.initialize(),
      b.initialization.initialize(),
    ]);
    expect(outcomeA).toMatchObject({ status: "ready" });
    expect(outcomeB).toMatchObject({ status: "ready" });
    expect(storage.value).toBeNull();
    const inspected = await inspectDatabase(factory);
    expect(metaRecord<CleanupMeta>(inspected.meta, COMPOSER_META_KEYS.cleanup)).toMatchObject({
      state: "removed",
      attempts: 1,
    });
  });
});

describe("typed IndexedDB lifecycle failures", () => {
  it("reports unavailable and blocked adapters as retryable typed outcomes", async () => {
    const unavailable = createIndexedDbCompositionProvider({ idbFactory: null });
    expect(await unavailable.initialization.initialize()).toMatchObject({
      status: "error",
      error: { code: "unavailable", retryable: true },
    });

    const blockedRequest: Partial<IDBOpenDBRequest> = {};
    const blockedFactory = {
      open: () => {
        queueMicrotask(() => blockedRequest.onblocked?.(new Event("blocked")));
        return blockedRequest as IDBOpenDBRequest;
      },
    } as IDBFactory;
    const blocked = createIndexedDbCompositionProvider({ idbFactory: blockedFactory });
    expect(await blocked.initialization.initialize()).toMatchObject({
      status: "error",
      error: { code: "blocked", retryable: true },
    });
  });

  it("reports a newer database version explicitly", async () => {
    const factory = new FDBFactory();
    (await openAtVersion(factory, COMPOSER_DATABASE_VERSION + 1)).close();
    const provider = createIndexedDbCompositionProvider({ idbFactory: factory });
    expect(await provider.initialization.initialize()).toMatchObject({
      status: "error",
      error: { code: "unsupported-version", retryable: false },
    });
  });

  it("closes on versionchange, fails active calls explicitly, and permits retry", async () => {
    const factory = new FDBFactory();
    const originalOpen = factory.open.bind(factory);
    let providerDb: IDBDatabase | undefined;
    vi.spyOn(factory, "open").mockImplementation((name, version) => {
      const open = originalOpen(name, version);
      open.addEventListener("success", () => {
        if (!providerDb) providerDb = open.result;
      });
      return open;
    });
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: new MemoryLegacyStorage(null),
      idFactory: sequentialIds(),
      now: () => T1,
    });
    await provider.initialization.initialize();
    expect(providerDb).toBeDefined();
    providerDb!.onversionchange?.(new Event("versionchange") as unknown as IDBVersionChangeEvent);
    await expect(provider.store.list()).rejects.toMatchObject({
      code: "versionchange",
      retryable: true,
    });
    expect(await provider.initialization.retry()).toMatchObject({ status: "ready" });
  });

  it("aborts upgrade writes atomically and leaves the legacy key unchanged", async () => {
    const factory = new FDBFactory();
    const raw = legacyDocument();
    const storage = new MemoryLegacyStorage(raw);
    vi.spyOn(FDBObjectStore.prototype, "add").mockImplementationOnce(() => {
      throw new DOMException("synthetic write failure", "AbortError");
    });
    const provider = createIndexedDbCompositionProvider({
      idbFactory: factory,
      legacyStorage: storage,
      idFactory: sequentialIds(),
      now: () => T1,
    });
    const outcome = await provider.initialization.initialize();
    expect(outcome).toMatchObject({
      status: "error",
      error: { code: "transaction-failed", retryable: true },
    });
    expect(storage.value).toBe(raw);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(CompositionPersistenceError);
  });
});
