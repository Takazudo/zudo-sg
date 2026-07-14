import type { Dirent, Stats } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import type { CompositionRecord } from "../../library";

/** Production JSX is supplied by the caller; the filesystem layer never generates it. */
export type CompositionJsxProvider = (
  record: CompositionRecord,
) => string | Promise<string>;

/** Narrow injectable seam used to exercise filesystem failure recovery. */
export interface FilesystemStoreOperations {
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  lstat(path: string): Promise<Stats>;
  realpath(path: string): Promise<string>;
  readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
  open(path: string, flags: number, mode?: number): Promise<FileHandle>;
  rename(oldPath: string, newPath: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

export interface FilesystemCompositionStoreOptions {
  /** The fixed directory below which all Composer-owned artifacts live. */
  compositionsRoot: string;
  /** Supplies the exact production output used to repair missing/stale JSX. */
  provideJsx: CompositionJsxProvider;
  /** Test/fault-injection seam. Omitted methods use Node's real filesystem. */
  operations?: Partial<FilesystemStoreOperations>;
  /** Test-only random source seam; values must contain only URL-safe characters. */
  randomToken?: () => string;
  /** Clock used when a provider-owned lifecycle operation changes a record. */
  now?: () => string;
}
