import { expect, type Page } from "@playwright/test";

export const COMPOSER_DATABASE_NAME = "zudo-sg-composer";
export const COMPOSER_RECORD_STORE = "compositions";
export const COMPOSER_META_STORE = "meta";
export const LEGACY_COMPOSER_STORAGE_KEY = "sg-composer-document";
export const COMPOSER_PATH = "/composer/";
export const COMPOSER_PREVIEW_PATH = "/composer/preview";
export const COMPOSER_CANVAS_IFRAME = ".sg-composer-canvas-frame iframe";

export interface BrowserCompositionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  document: {
    schemaVersion: number;
    id: string;
    name: string;
    root: unknown[];
    [key: string]: unknown;
  };
}

export interface BrowserComposerDatabase {
  records: BrowserCompositionRecord[];
  meta: Array<Record<string, unknown>>;
}

/**
 * Opens the library route and then a real persisted record before returning.
 * Existing editor walkthroughs use this instead of assuming `/composer` is a
 * singleton localStorage document. An empty library is populated through the
 * user-facing New composition action, never by a private in-app shortcut.
 */
export async function openComposerRecord(
  page: Page,
  options: { path?: string; recordName?: string | RegExp } = {},
): Promise<void> {
  await page.goto(options.path ?? COMPOSER_PATH);
  const libraryHeading = page.getByRole("heading", { name: "Composition library" });
  await expect(libraryHeading).toBeVisible({
    timeout: 15_000,
  });
  await expect(libraryHeading, "the mounted library must start in the viewport").toBeInViewport();

  const requested = options.recordName
    ? page.getByRole("button", { name: options.recordName })
    : page.locator(".sg-composer-library-open").first();
  if (await requested.count()) {
    await requested.click();
  } else {
    await page.getByRole("button", { name: "New composition" }).first().click();
  }

  await expect(page).toHaveURL(/#\/composition\/(?:indexeddb|files)\/[^/]+$/);
  await expect(page.locator("html[data-sg-composer-doc]")).toBeAttached();
  await expect(
    page.frameLocator(COMPOSER_CANVAS_IFRAME).locator("[data-composer-canvas]"),
  ).toBeVisible({ timeout: 15_000 });
}

/** Navigate to the library without opening or implicitly creating a record. */
export async function openComposerLibrary(page: Page, path = COMPOSER_PATH): Promise<void> {
  await page.goto(path);
  const libraryHeading = page.getByRole("heading", { name: "Composition library" });
  await expect(libraryHeading).toBeVisible({
    timeout: 15_000,
  });
  await expect(libraryHeading, "the mounted library must start in the viewport").toBeInViewport();
}

/**
 * Delete the real database from a route that does not mount the Composer
 * provider. This avoids racing an app-owned open connection.
 */
export async function removeComposerDatabase(page: Page): Promise<void> {
  await page.goto(COMPOSER_PREVIEW_PATH);
  await page.evaluate(async (databaseName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB delete failed"));
      request.onblocked = () => reject(new Error("IndexedDB delete was blocked"));
    });
  }, COMPOSER_DATABASE_NAME);
}

/** Reset both current storage and the one retired migration source. */
export async function resetComposerPersistence(page: Page): Promise<void> {
  await removeComposerDatabase(page);
  await page.evaluate((legacyKey) => localStorage.removeItem(legacyKey), LEGACY_COMPOSER_STORAGE_KEY);
}

/** Set up the only legitimate use of the retired document localStorage key. */
export async function prepareLegacyMigration(page: Page, raw: string): Promise<void> {
  await removeComposerDatabase(page);
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: LEGACY_COMPOSER_STORAGE_KEY, value: raw },
  );
}

/** Inspect canonical browser records and migration metadata in a real browser. */
export async function inspectComposerDatabase(page: Page): Promise<BrowserComposerDatabase> {
  return page.evaluate(
    async ({ databaseName, recordStore, metaStore }) => {
      const requestResult = <T,>(request: IDBRequest<T>): Promise<T> =>
        new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        });
      const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
        new Promise((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
          transaction.onerror = () => undefined;
        });
      // The app owns physical schema upgrades. Opening without a version lets
      // acceptance helpers inspect whichever current version the app created,
      // rather than failing when that independent schema version changes.
      const request = indexedDB.open(databaseName);
      const db = await requestResult(request);
      try {
        const transaction = db.transaction([recordStore, metaStore], "readonly");
        const completed = transactionComplete(transaction);
        const records = requestResult(transaction.objectStore(recordStore).getAll());
        const meta = requestResult(transaction.objectStore(metaStore).getAll());
        const result = await Promise.all([records, meta]);
        await completed;
        return {
          records: result[0] as BrowserCompositionRecord[],
          meta: result[1] as Array<Record<string, unknown>>,
        };
      } finally {
        db.close();
      }
    },
    {
      databaseName: COMPOSER_DATABASE_NAME,
      recordStore: COMPOSER_RECORD_STORE,
      metaStore: COMPOSER_META_STORE,
    },
  );
}

/** Replace canonical records in one real read/write transaction. */
export async function replaceComposerRecords(
  page: Page,
  records: readonly BrowserCompositionRecord[],
): Promise<void> {
  await page.evaluate(
    async ({ databaseName, recordStore, nextRecords }) => {
      const requestResult = <T,>(request: IDBRequest<T>): Promise<T> =>
        new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        });
      const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
        new Promise((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
          transaction.onerror = () => undefined;
        });
      const db = await requestResult(indexedDB.open(databaseName));
      try {
        const transaction = db.transaction(recordStore, "readwrite");
        const completed = transactionComplete(transaction);
        const store = transaction.objectStore(recordStore);
        store.clear();
        for (const record of nextRecords) store.put(record);
        await completed;
      } finally {
        db.close();
      }
    },
    {
      databaseName: COMPOSER_DATABASE_NAME,
      recordStore: COMPOSER_RECORD_STORE,
      nextRecords: records,
    },
  );
}

/**
 * Make the app-owned connection receive a genuine `versionchange` event by
 * deleting the database from a second same-origin page.
 */
export async function invalidateComposerConnection(page: Page, peer: Page): Promise<void> {
  await peer.goto(COMPOSER_PREVIEW_PATH);
  await peer.evaluate(async (databaseName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB delete failed"));
      request.onblocked = () => reject(new Error("App did not close on versionchange"));
    });
  }, COMPOSER_DATABASE_NAME);
  await expect(page.locator("html[data-sg-composer-doc]")).toBeAttached();
}

export function captureUnexpectedBrowserErrors(page: Page): {
  pageErrors: string[];
  consoleErrors: string[];
} {
  const errors = { pageErrors: [] as string[], consoleErrors: [] as string[] };
  page.on("pageerror", (error) => errors.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.consoleErrors.push(message.text());
  });
  return errors;
}
