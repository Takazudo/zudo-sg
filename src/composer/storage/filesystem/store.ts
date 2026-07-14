import { constants, type Stats } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  COMPOSITION_PROVIDERS,
  CompositionPersistenceError,
  compareCompositionSummariesNewestFirst,
  isSafeCompositionRecordId,
  loadCompositionRecord,
  summarizeComposition,
  validateCompositionRecord,
  type CompositionLoadOutcome,
  type CompositionPersistenceOperation,
  type CompositionRecord,
  type CompositionStore,
  type CompositionSummary,
} from "../../library";
import { cloneJson } from "../../model/json";
import type {
  FilesystemCompositionStoreOptions,
  FilesystemStoreOperations,
} from "./types";

const JSON_SUFFIX = ".composition.json";
const JSX_SUFFIX = ".tsx";
const OWNED_JSON_PATTERN = /^composition-([a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?)\.composition\.json$/;
const MAX_TEMP_ATTEMPTS = 16;
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

const defaultOperations: FilesystemStoreOperations = {
  mkdir: (path, options) => nodeFs.mkdir(path, options),
  lstat: (path) => nodeFs.lstat(path),
  realpath: (path) => nodeFs.realpath(path),
  readdir: (path, options) => nodeFs.readdir(path, options),
  open: (path, flags, mode) => nodeFs.open(path, flags, mode),
  rename: (oldPath, newPath) => nodeFs.rename(oldPath, newPath),
  unlink: (path) => nodeFs.unlink(path),
};

const rootQueues = new Map<string, Promise<void>>();

function errorCode(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("code" in value)) return undefined;
  return typeof value.code === "string" ? value.code : undefined;
}

function sameFile(a: Stats, b: Stats): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

function compareNames(a: { name: string }, b: { name: string }): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function operationError(
  operation: CompositionPersistenceOperation,
  code: "blocked" | "validation" | "read-failed" | "write-failed",
  message: string,
  cause?: unknown,
): CompositionPersistenceError {
  return new CompositionPersistenceError(
    operation,
    code,
    message,
    code === "read-failed" || code === "write-failed",
    cause === undefined ? undefined : { cause },
  );
}

function rethrow(
  operation: CompositionPersistenceOperation,
  code: "read-failed" | "write-failed",
  message: string,
  cause: unknown,
): never {
  if (cause instanceof CompositionPersistenceError) throw cause;
  throw operationError(operation, code, message, cause);
}

async function serialized<T>(root: string, task: () => Promise<T>): Promise<T> {
  const previous = rootQueues.get(root) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  rootQueues.set(root, settled);
  void settled.then(() => {
    if (rootQueues.get(root) === settled) rootQueues.delete(root);
  });
  return run;
}

interface ReadFileResult {
  text: string;
  stats: Stats;
}

interface CanonicalResult {
  outcome: CompositionLoadOutcome;
  stats: Stats;
}

export class FilesystemCompositionStore implements CompositionStore {
  readonly provider = COMPOSITION_PROVIDERS.files;

  private constructor(
    private readonly rootPath: string,
    private readonly realRoot: string,
    private readonly rootStats: Stats,
    private readonly provideJsx: FilesystemCompositionStoreOptions["provideJsx"],
    private readonly operations: FilesystemStoreOperations,
    private readonly randomToken: () => string,
  ) {}

  static async create(
    options: FilesystemCompositionStoreOptions,
  ): Promise<FilesystemCompositionStore> {
    const rootPath = resolve(options.compositionsRoot);
    const operations = { ...defaultOperations, ...options.operations };

    try {
      await operations.mkdir(rootPath, { recursive: true });
      const rootStats = await operations.lstat(rootPath);
      if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
        throw operationError(
          "initialize",
          "blocked",
          `Composer compositions root is not a real directory: ${rootPath}`,
        );
      }
      const realRoot = await operations.realpath(rootPath);
      if (!isAbsolute(realRoot)) {
        throw operationError(
          "initialize",
          "blocked",
          `Composer compositions root did not resolve to an absolute path: ${rootPath}`,
        );
      }
      const realStats = await operations.lstat(realRoot);
      if (realStats.isSymbolicLink() || !realStats.isDirectory() || !sameFile(rootStats, realStats)) {
        throw operationError(
          "initialize",
          "blocked",
          `Composer compositions root failed realpath verification: ${rootPath}`,
        );
      }
      return new FilesystemCompositionStore(
        rootPath,
        realRoot,
        rootStats,
        options.provideJsx,
        operations,
        options.randomToken ?? (() => randomBytes(18).toString("base64url")),
      );
    } catch (cause) {
      if (cause instanceof CompositionPersistenceError) throw cause;
      throw operationError(
        "initialize",
        "read-failed",
        `Could not initialize Composer compositions root: ${rootPath}`,
        cause,
      );
    }
  }

  async list(): Promise<readonly CompositionSummary[]> {
    return this.run("list", async () => {
      let entries;
      try {
        entries = await this.operations.readdir(this.realRoot, { withFileTypes: true });
        await this.assertRoot("list");
      } catch (cause) {
        rethrow("list", "read-failed", "Could not list Composer composition files.", cause);
      }

      const summaries: CompositionSummary[] = [];
      for (const entry of entries.sort(compareNames)) {
        const match = OWNED_JSON_PATTERN.exec(entry.name);
        if (!match || entry.isSymbolicLink() || !entry.isFile()) continue;
        const id = match[1]!;
        const canonical = await this.readCanonical("list", id);
        if (canonical === undefined) continue;
        if (canonical.outcome.status !== "loaded") {
          throw operationError(
            "list",
            "validation",
            `Canonical composition JSON is invalid for id "${id}"; it was preserved and JSX was not changed.`,
          );
        }
        await this.repairJsx("list", canonical.outcome.record);
        summaries.push(summarizeComposition(canonical.outcome.record));
      }
      return summaries.sort(compareCompositionSummariesNewestFirst);
    });
  }

  async get(id: string): Promise<CompositionLoadOutcome> {
    this.assertSafeId("get", id);
    return this.run("get", async () => {
      const canonical = await this.readCanonical("get", id);
      if (canonical === undefined) return { status: "not-found", id };
      if (canonical.outcome.status === "loaded") {
        await this.repairJsx("get", canonical.outcome.record);
      }
      return canonical.outcome;
    });
  }

  /**
   * Stores canonical JSON first and derived JSX second. Supplying `jsx`
   * preserves an already-generated exact production result; otherwise the
   * injected provider is called.
   */
  async put(record: CompositionRecord, jsx?: string): Promise<void> {
    const validation = validateCompositionRecord(record);
    if (!validation.ok) {
      throw operationError("put", "validation", validation.issue.message);
    }
    if (jsx !== undefined && typeof jsx !== "string") {
      throw operationError("put", "validation", "Generated JSX must be a string.");
    }
    const snapshot = cloneJson(validation.record);
    const snapshotValidation = validateCompositionRecord(snapshot);
    if (!snapshotValidation.ok) {
      throw operationError("put", "validation", snapshotValidation.issue.message);
    }
    const id = snapshotValidation.record.id;
    const canonical = `${JSON.stringify(snapshotValidation.record, null, 2)}\n`;

    await this.run("put", async () => {
      const productionJsx = jsx ?? await this.getProductionJsx("put", snapshotValidation.record);
      await this.atomicReplace("put", this.jsonPath(id), canonical);
      await this.atomicReplace("put", this.jsxPath(id), productionJsx);
    });
  }

  async delete(id: string): Promise<boolean> {
    this.assertSafeId("delete", id);
    return this.run("delete", async () => {
      const canonical = await this.readCanonical("delete", id);
      if (canonical === undefined) return false;
      if (canonical.outcome.status !== "loaded") {
        throw operationError(
          "delete",
          "validation",
          `Canonical composition JSON is invalid for id "${id}"; no files were deleted.`,
        );
      }
      await this.deleteValidatedPair("delete", id, canonical.stats);
      return true;
    });
  }

  async clear(): Promise<void> {
    await this.run("clear", async () => {
      let entries;
      try {
        entries = await this.operations.readdir(this.realRoot, { withFileTypes: true });
        await this.assertRoot("clear");
      } catch (cause) {
        rethrow("clear", "read-failed", "Could not inspect Composer composition files.", cause);
      }

      const records: Array<{ id: string; stats: Stats }> = [];
      for (const entry of entries.sort(compareNames)) {
        const match = OWNED_JSON_PATTERN.exec(entry.name);
        if (!match || entry.isSymbolicLink() || !entry.isFile()) continue;
        const id = match[1]!;
        const canonical = await this.readCanonical("clear", id);
        if (canonical === undefined) continue;
        if (canonical.outcome.status !== "loaded") {
          throw operationError(
            "clear",
            "validation",
            `Canonical composition JSON is invalid for id "${id}"; no files were deleted.`,
          );
        }
        records.push({ id, stats: canonical.stats });
      }

      for (const record of records) {
        const current = await this.readCanonical("clear", record.id);
        if (
          current === undefined ||
          current.outcome.status !== "loaded" ||
          !sameFile(current.stats, record.stats)
        ) {
          throw operationError(
            "clear",
            "blocked",
            `Canonical composition changed while clearing id "${record.id}"; remaining files were preserved.`,
          );
        }
        await this.deleteValidatedPair("clear", record.id, current.stats);
      }
    });
  }

  private async run<T>(
    operation: CompositionPersistenceOperation,
    task: () => Promise<T>,
  ): Promise<T> {
    return serialized(this.realRoot, async () => {
      await this.assertRoot(operation);
      return task();
    });
  }

  private assertSafeId(operation: CompositionPersistenceOperation, id: string): void {
    if (!isSafeCompositionRecordId(id)) {
      throw operationError(
        operation,
        "validation",
        `Composition id is not a stable path-safe id: ${JSON.stringify(id)}`,
      );
    }
  }

  private async assertRoot(operation: CompositionPersistenceOperation): Promise<void> {
    try {
      const current = await this.operations.lstat(this.rootPath);
      if (current.isSymbolicLink() || !current.isDirectory() || !sameFile(current, this.rootStats)) {
        throw operationError(
          operation,
          "blocked",
          `Composer compositions root was replaced or is no longer a real directory: ${this.rootPath}`,
        );
      }
      const currentReal = await this.operations.realpath(this.rootPath);
      if (currentReal !== this.realRoot) {
        throw operationError(
          operation,
          "blocked",
          `Composer compositions root now resolves outside its verified location: ${this.rootPath}`,
        );
      }
    } catch (cause) {
      if (cause instanceof CompositionPersistenceError) throw cause;
      throw operationError(
        operation,
        "blocked",
        `Could not verify Composer compositions root: ${this.rootPath}`,
        cause,
      );
    }
  }

  private ownedPath(filename: string): string {
    const path = join(this.realRoot, filename);
    const fromRoot = relative(this.realRoot, path);
    if (fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
      throw new Error("Internal Composer filename escaped its verified root.");
    }
    return path;
  }

  private jsonPath(id: string): string {
    return this.ownedPath(`composition-${id}${JSON_SUFFIX}`);
  }

  private jsxPath(id: string): string {
    return this.ownedPath(`composition-${id}${JSX_SUFFIX}`);
  }

  private async readFileNoFollow(
    operation: CompositionPersistenceOperation,
    path: string,
  ): Promise<ReadFileResult | undefined> {
    await this.assertRoot(operation);
    let before: Stats;
    try {
      before = await this.operations.lstat(path);
    } catch (cause) {
      if (errorCode(cause) === "ENOENT") return undefined;
      rethrow(operation, "read-failed", `Could not inspect Composer file: ${basename(path)}`, cause);
    }
    if (before.isSymbolicLink() || !before.isFile()) {
      throw operationError(
        operation,
        "blocked",
        `Refusing to follow or replace non-regular Composer path: ${basename(path)}`,
      );
    }

    let handle;
    try {
      handle = await this.operations.open(path, constants.O_RDONLY | NO_FOLLOW);
      const opened = await handle.stat();
      if (!opened.isFile() || !sameFile(before, opened)) {
        throw operationError(
          operation,
          "blocked",
          `Composer file changed while it was being opened: ${basename(path)}`,
        );
      }
      const text = await handle.readFile({ encoding: "utf8" });
      await this.assertRoot(operation);
      return { text, stats: opened };
    } catch (cause) {
      if (errorCode(cause) === "ENOENT") return undefined;
      if (errorCode(cause) === "ELOOP") {
        throw operationError(
          operation,
          "blocked",
          `Refusing to follow Composer symlink path: ${basename(path)}`,
          cause,
        );
      }
      rethrow(operation, "read-failed", `Could not read Composer file: ${basename(path)}`, cause);
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }

  private async readCanonical(
    operation: CompositionPersistenceOperation,
    expectedId: string,
  ): Promise<CanonicalResult | undefined> {
    const file = await this.readFileNoFollow(operation, this.jsonPath(expectedId));
    if (file === undefined) return undefined;

    let raw: unknown;
    try {
      raw = JSON.parse(file.text);
    } catch {
      return {
        stats: file.stats,
        outcome: {
          status: "invalid",
          issue: { code: "invalid-record", message: "Canonical composition file is not valid JSON." },
          raw: file.text,
        },
      };
    }

    const outcome = loadCompositionRecord(raw);
    if (outcome.status === "loaded" && outcome.record.id !== expectedId) {
      return {
        stats: file.stats,
        outcome: {
          status: "invalid",
          issue: {
            code: "invalid-record",
            message: "Canonical composition record id does not match its derived filename.",
          },
          raw,
        },
      };
    }
    return { outcome, stats: file.stats };
  }

  private async getProductionJsx(
    operation: CompositionPersistenceOperation,
    record: CompositionRecord,
  ): Promise<string> {
    try {
      const jsx = await this.provideJsx(cloneJson(record));
      if (typeof jsx !== "string") {
        throw new TypeError("Production JSX provider did not return a string.");
      }
      return jsx;
    } catch (cause) {
      rethrow(
        operation,
        "write-failed",
        `Could not obtain production JSX for composition "${record.id}".`,
        cause,
      );
    }
  }

  private async repairJsx(
    operation: CompositionPersistenceOperation,
    record: CompositionRecord,
  ): Promise<void> {
    const expected = await this.getProductionJsx(operation, record);
    const path = this.jsxPath(record.id);
    const existing = await this.readFileNoFollow(operation, path);
    if (existing?.text === expected) return;
    await this.atomicReplace(operation, path, expected);
  }

  private async assertReplaceablePath(
    operation: CompositionPersistenceOperation,
    path: string,
  ): Promise<void> {
    try {
      const stats = await this.operations.lstat(path);
      if (stats.isSymbolicLink() || !stats.isFile()) {
        throw operationError(
          operation,
          "blocked",
          `Refusing to replace non-regular Composer path: ${basename(path)}`,
        );
      }
    } catch (cause) {
      if (errorCode(cause) === "ENOENT") return;
      if (cause instanceof CompositionPersistenceError) throw cause;
      rethrow(operation, "write-failed", `Could not inspect Composer path: ${basename(path)}`, cause);
    }
  }

  private async atomicReplace(
    operation: CompositionPersistenceOperation,
    finalPath: string,
    contents: string,
  ): Promise<void> {
    await this.assertRoot(operation);
    await this.assertReplaceablePath(operation, finalPath);

    let temporaryPath: string | undefined;
    let handle;
    try {
      for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
        const token = this.randomToken();
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) {
          throw operationError(operation, "blocked", "Temporary filename source returned an unsafe token.");
        }
        const candidate = this.ownedPath(`.${basename(finalPath)}.${token}.tmp`);
        try {
          handle = await this.operations.open(
            candidate,
            constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | NO_FOLLOW,
            0o600,
          );
          temporaryPath = candidate;
          break;
        } catch (cause) {
          if (errorCode(cause) === "EEXIST") continue;
          throw cause;
        }
      }
      if (handle === undefined || temporaryPath === undefined) {
        throw operationError(
          operation,
          "write-failed",
          `Could not allocate an exclusive temporary file for ${basename(finalPath)}.`,
        );
      }

      await handle.writeFile(contents, { encoding: "utf8" });
      await handle.sync();
      await handle.close();
      handle = undefined;

      await this.assertRoot(operation);
      await this.assertReplaceablePath(operation, finalPath);
      await this.operations.rename(temporaryPath, finalPath);
      temporaryPath = undefined;
      await this.assertRoot(operation);
    } catch (cause) {
      rethrow(operation, "write-failed", `Could not atomically replace ${basename(finalPath)}.`, cause);
    } finally {
      await handle?.close().catch(() => undefined);
      if (temporaryPath !== undefined) {
        await this.operations.unlink(temporaryPath).catch(() => undefined);
      }
    }
  }

  private async deleteValidatedPair(
    operation: "delete" | "clear",
    id: string,
    canonicalStats: Stats,
  ): Promise<void> {
    const jsxPath = this.jsxPath(id);
    try {
      await this.assertRoot(operation);
      const jsxStats = await this.operations.lstat(jsxPath).catch((cause: unknown) => {
        if (errorCode(cause) === "ENOENT") return undefined;
        throw cause;
      });
      if (jsxStats?.isFile() && !jsxStats.isSymbolicLink()) {
        await this.operations.unlink(jsxPath);
      }

      await this.assertRoot(operation);
      const currentCanonical = await this.operations.lstat(this.jsonPath(id));
      if (
        currentCanonical.isSymbolicLink() ||
        !currentCanonical.isFile() ||
        !sameFile(currentCanonical, canonicalStats)
      ) {
        throw operationError(
          operation,
          "blocked",
          `Canonical composition changed before deleting id "${id}".`,
        );
      }
      await this.operations.unlink(this.jsonPath(id));
      await this.assertRoot(operation);
    } catch (cause) {
      rethrow(operation, "write-failed", `Could not delete composition files for id "${id}".`, cause);
    }
  }
}

export function createFilesystemCompositionStore(
  options: FilesystemCompositionStoreOptions,
): Promise<FilesystemCompositionStore> {
  return FilesystemCompositionStore.create(options);
}
