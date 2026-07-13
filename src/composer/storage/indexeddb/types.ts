import type { IdFactory } from "../../model/id-factory";

export const COMPOSER_DATABASE_NAME = "zudo-sg-composer";
export const COMPOSER_DATABASE_VERSION = 1;
export const COMPOSITIONS_STORE_NAME = "compositions";
export const META_STORE_NAME = "meta";
export const UPDATED_AT_INDEX_NAME = "updatedAt";
export const LEGACY_COMPOSER_STORAGE_KEY = "sg-composer-document";

export const COMPOSER_META_KEYS = {
  schema: "schema",
  initialization: "initialization",
  migration: "migration",
  cleanup: "cleanup",
} as const;

export interface SchemaMeta {
  key: typeof COMPOSER_META_KEYS.schema;
  databaseVersion: typeof COMPOSER_DATABASE_VERSION;
  recordSchemaVersion: number;
}

export interface InitializationMeta {
  key: typeof COMPOSER_META_KEYS.initialization;
  state: "ready" | "recovered" | "quarantined" | "bypassed";
  initializedAt: string;
  recordId?: string;
}

export type MigrationMeta =
  | {
      key: typeof COMPOSER_META_KEYS.migration;
      state: "none";
    }
  | {
      key: typeof COMPOSER_META_KEYS.migration;
      state: "imported";
      recordId: string;
      originalId?: string;
    }
  | {
      key: typeof COMPOSER_META_KEYS.migration;
      state: "recovered";
      reason: "malformed";
      recordId: string;
      rawBackup: string;
    }
  | {
      key: typeof COMPOSER_META_KEYS.migration;
      state: "quarantined" | "bypassed";
      foundSchemaVersion: number;
      rawBackup: string;
      recordId?: string;
    };

export type CleanupMeta =
  | {
      key: typeof COMPOSER_META_KEYS.cleanup;
      state: "not-needed" | "retained";
    }
  | {
      key: typeof COMPOSER_META_KEYS.cleanup;
      state: "pending" | "changed";
      snapshot: string;
      attempts: number;
    }
  | {
      key: typeof COMPOSER_META_KEYS.cleanup;
      state: "removed";
      completedAt: string;
      attempts: number;
    };

export type ComposerMetaRecord =
  | SchemaMeta
  | InitializationMeta
  | MigrationMeta
  | CleanupMeta;

/** The deliberately small localStorage seam used by migration and cleanup. */
export interface LegacyComposerStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export interface IndexedDbCompositionProviderOptions {
  /** `null` explicitly represents an unavailable browser implementation. */
  idbFactory?: IDBFactory | null;
  /** Defaults to the current realm's localStorage, read lazily during upgrade. */
  legacyStorage?: LegacyComposerStorage;
  idFactory?: IdFactory;
  now?: () => string;
}
