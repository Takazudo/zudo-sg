import { expect, test } from "@playwright/test";
import {
  COMPOSER_CANVAS_IFRAME,
  LEGACY_COMPOSER_STORAGE_KEY,
  captureUnexpectedBrowserErrors,
  inspectComposerDatabase,
  invalidateComposerConnection,
  openComposerLibrary,
  openComposerRecord,
  prepareLegacyMigration,
  replaceComposerRecords,
  resetComposerPersistence,
  type BrowserCompositionRecord,
} from "./support/composer-persistence";

const T1 = "2026-01-02T03:04:05.000Z";
const T2 = "2026-01-02T04:04:05.000Z";
const T3 = "2026-01-02T05:04:05.000Z";

function recordFrom(
  source: BrowserCompositionRecord,
  id: string,
  updatedAt: string,
): BrowserCompositionRecord {
  return {
    ...structuredClone(source),
    id,
    createdAt: T1,
    updatedAt,
    document: {
      ...structuredClone(source.document),
      id,
      name: `Record ${id}`,
    },
  };
}

function legacyDocument(options: { id?: string; schemaVersion?: number } = {}): string {
  const id = options.id ?? "legacy-record";
  return JSON.stringify({
    schemaVersion: options.schemaVersion ?? 1,
    id,
    name: "Legacy browser record",
    root: [],
  });
}

test.describe("Composer real-browser IndexedDB lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await resetComposerPersistence(page);
  });

  test.afterEach(async ({ page }) => {
    await resetComposerPersistence(page);
  });

  test("create, inspect, update, duplicate, delete, clear, and newest ordering", async ({ page }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await openComposerLibrary(page);

    await expect(page.locator(".sg-composer-library-open")).toHaveCount(1);
    await page.getByRole("button", { name: "New composition" }).first().click();
    await expect(page.frameLocator(COMPOSER_CANVAS_IFRAME).locator("[data-composer-canvas]")).toBeVisible();

    const createdUrl = page.url();
    const createdId = decodeURIComponent(createdUrl.split("/").at(-1) ?? "");
    let database = await inspectComposerDatabase(page);
    expect(database.records.map(({ id }) => id)).toContain(createdId);

    await page.getByRole("button", { name: "Add component to document root" }).click();
    const chooser = page.locator("dialog.sg-composer-chooser");
    await chooser.getByPlaceholder("Search components…").fill("Callout");
    await chooser.getByRole("button", { name: "Callout", exact: true }).click();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");

    await page.getByRole("button", { name: "Duplicate composition", exact: true }).click();
    await expect(page).not.toHaveURL(createdUrl);
    database = await inspectComposerDatabase(page);
    expect(database.records).toHaveLength(3);
    const duplicate = database.records.find(({ document }) => document.name.endsWith(" copy"));
    expect(duplicate?.document.root).toHaveLength(2);

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Composition library" })).toBeVisible();
    await page.getByRole("button", { name: /^Delete Product overview copy$/ }).click();
    await page.getByRole("button", { name: "Delete composition", exact: true }).click();
    await expect(page.locator(".sg-composer-library-open")).toHaveCount(2);

    database = await inspectComposerDatabase(page);
    const seed = database.records[0]!;
    const ordered = [
      recordFrom(seed, "newest", T3),
      recordFrom(seed, "same-a", T2),
      recordFrom(seed, "same-z", T2),
      recordFrom(seed, "oldest", T1),
    ];
    await replaceComposerRecords(page, ordered);
    await page.reload();
    await expect(page.locator(".sg-composer-library-row-id")).toHaveText([
      "ID: newest",
      "ID: same-a",
      "ID: same-z",
      "ID: oldest",
    ]);

    await page.getByRole("button", { name: "Clear library", exact: true }).click();
    await page.getByRole("button", { name: "Clear library", exact: true }).last().click();
    await expect(page.getByRole("heading", { name: "No compositions yet" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "No compositions yet" })).toBeVisible();
    expect((await inspectComposerDatabase(page)).records).toEqual([]);
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });

  test("provider-qualified direct hashes survive refresh and history; malformed encoding is contained", async ({ page }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await openComposerRecord(page);
    const detailUrl = page.url();
    expect(detailUrl).toMatch(/\/composer\/#\/composition\/indexeddb\/[^/]+$/);

    await page.reload();
    await expect(page.frameLocator(COMPOSER_CANVAS_IFRAME).locator("[data-composer-canvas]")).toBeVisible();
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/composer\/#\/$/);
    await page.goBack();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.frameLocator(COMPOSER_CANVAS_IFRAME).locator("[data-composer-canvas]")).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/composer\/#\/$/);

    await page.goto("/composer/#/composition/indexeddb/%E0%A4%A");
    await expect(page.getByRole("heading", { name: "Composition could not be opened" })).toBeVisible();
    await expect(page.getByText(/not valid percent encoding/i)).toBeVisible();

    await openComposerLibrary(page, "/composer");
    await expect(page).toHaveURL(/\/composer\/#\/$/);
    await openComposerLibrary(page, "/composer/");
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });

  test("versionchange closes the old connection and a failed save preserves the in-memory draft", async ({ page, context }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await openComposerRecord(page);
    const peer = await context.newPage();
    await invalidateComposerConnection(page, peer);
    await peer.close();

    await page.getByRole("button", { name: "Add component to document root" }).click();
    const chooser = page.locator("dialog.sg-composer-chooser");
    await chooser.getByPlaceholder("Search components…").fill("Callout");
    await chooser.getByRole("button", { name: "Callout", exact: true }).click();

    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "error");
    await expect(page.locator("ul.sg-composer-tree-list:not(.sg-composer-tree-list-nested) > li")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page.locator(".sg-composer-library-alert-error")).toContainText(/save|storage/i);
    await expect(page.locator("ul.sg-composer-tree-list:not(.sg-composer-tree-list-nested) > li")).toHaveCount(2);
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });
});

test.describe("Composer real-browser legacy migration", () => {
  test.afterEach(async ({ page }) => {
    await resetComposerPersistence(page);
  });

  test("imports every supported row and removes the retired source only after commit", async ({ page }) => {
    await prepareLegacyMigration(page, legacyDocument());
    await openComposerLibrary(page);

    await expect(page.getByRole("button", { name: "Open Legacy browser record" })).toBeVisible();
    const database = await inspectComposerDatabase(page);
    expect(database.records).toMatchObject([{ id: "legacy-record", document: { id: "legacy-record" } }]);
    expect(database.meta).toContainEqual(expect.objectContaining({ key: "migration", state: "imported" }));
    await expect.poll(() => page.evaluate(
      (key) => localStorage.getItem(key),
      LEGACY_COMPOSER_STORAGE_KEY,
    )).toBeNull();
  });

  test("malformed and future rows preserve their source; Start fresh is explicit", async ({ page }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await prepareLegacyMigration(page, "{not valid json");
    await openComposerLibrary(page);
    await expect(page.getByRole("heading", { name: "Recovery notice" })).toBeVisible();
    await expect(page.getByText(/original source has been preserved/i)).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_COMPOSER_STORAGE_KEY)).toBe("{not valid json");

    await prepareLegacyMigration(page, legacyDocument({ schemaVersion: 99 }));
    await openComposerLibrary(page);
    await expect(page.getByRole("heading", { name: "Recovery required" })).toBeVisible();
    await page.getByRole("button", { name: "Start fresh", exact: true }).click();
    await page.getByRole("button", { name: "Start fresh", exact: true }).last().click();
    await expect(page.locator(".sg-composer-library-open")).toHaveCount(1);
    expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_COMPOSER_STORAGE_KEY))
      .toBe(legacyDocument({ schemaVersion: 99 }));
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });

  test("cleanup failure is retryable and detects a changed source without data loss", async ({ page }) => {
    await prepareLegacyMigration(page, legacyDocument());
    await page.evaluate(() => sessionStorage.setItem("composer-e2e-fail-cleanup", "1"));
    await page.addInitScript((legacyKey) => {
      const original = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (this: Storage, key: string): void {
        if (key === legacyKey && sessionStorage.getItem("composer-e2e-fail-cleanup") === "1") {
          throw new DOMException("Injected cleanup failure", "QuotaExceededError");
        }
        original.call(this, key);
      };
    }, LEGACY_COMPOSER_STORAGE_KEY);

    await openComposerLibrary(page);
    await expect(page.getByRole("heading", { name: "Recovery notice" })).toBeVisible();
    await expect(page.getByText(/cleanup/i)).toBeVisible();
    await page.evaluate(
      ({ key, value }) => {
        sessionStorage.removeItem("composer-e2e-fail-cleanup");
        localStorage.setItem(key, value);
      },
      { key: LEGACY_COMPOSER_STORAGE_KEY, value: legacyDocument({ id: "changed-source" }) },
    );
    await page.getByRole("button", { name: "Retry recovery", exact: true }).click();
    await expect(page.getByText(/source changed after import/i)).toBeVisible();
    expect((await inspectComposerDatabase(page)).records).toMatchObject([{ id: "legacy-record" }]);
    expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_COMPOSER_STORAGE_KEY))
      .toBe(legacyDocument({ id: "changed-source" }));
  });
});
