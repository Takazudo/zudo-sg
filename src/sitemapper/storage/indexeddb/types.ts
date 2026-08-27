export const SITEMAPPER_DATABASE_NAME = "zudo-sg-sitemapper";
export const SITEMAPPER_DATABASE_VERSION = 1;
export const SITEMAPS_STORE_NAME = "sitemaps";
export const META_STORE_NAME = "meta";
export const UPDATED_AT_INDEX_NAME = "updatedAt";

export const SITEMAPPER_META_KEYS = {
  schema: "schema",
  recoveryBackup: "recovery-backup",
} as const;

export interface SitemapSchemaMeta {
  key: typeof SITEMAPPER_META_KEYS.schema;
  databaseVersion: typeof SITEMAPPER_DATABASE_VERSION;
  recordSchemaVersion: number;
}

/** Exact structured-clone backup written before startFresh removes source records. */
export interface SitemapRecoveryBackupMeta {
  key: typeof SITEMAPPER_META_KEYS.recoveryBackup;
  snapshots: readonly {
    savedAt: string;
    records: readonly unknown[];
  }[];
}

export type SitemapMetaRecord = SitemapSchemaMeta | SitemapRecoveryBackupMeta;

export interface IndexedDbSitemapProviderOptions {
  /** `null` explicitly represents an unavailable browser implementation. */
  idbFactory?: IDBFactory | null;
  now?: () => string;
}
