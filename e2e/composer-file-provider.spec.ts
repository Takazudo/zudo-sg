import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  COMPOSER_CANVAS_IFRAME,
  captureUnexpectedBrowserErrors,
  openComposerLibrary,
  resetComposerPersistence,
} from "./support/composer-persistence";

const outputRoot = resolve(process.cwd(), "compositions");
let fixtureSandbox = "";
let backupRoot = "";
let hadExistingOutput = false;

async function outputNames(): Promise<string[]> {
  try {
    return (await readdir(outputRoot)).sort();
  } catch {
    return [];
  }
}

async function waitForFile(path: string): Promise<string> {
  await expect.poll(async () => {
    try {
      return (await stat(path)).isFile();
    } catch {
      return false;
    }
  }).toBe(true);
  return readFile(path, "utf8");
}

async function selectFilesProvider(page: Page): Promise<void> {
  await page.getByLabel("Provider").selectOption("files");
  await expect(page.getByText("Active database:")).toContainText("Development composition files");
}

function expectNoUnexpectedErrors(
  errors: ReturnType<typeof captureUnexpectedBrowserErrors>,
): void {
  expect(errors.pageErrors).toEqual([]);
  // The repair handshake intentionally receives 409 before resubmitting with
  // browser-generated JSX. Chromium reports that handled response as a
  // console error even though fetch resolves normally. The second test also
  // injects one expected transport abort; everything else remains forbidden.
  expect(errors.consoleErrors.filter((message) =>
    !/status of 409 \(Conflict\)|ERR_FAILED|Failed to fetch/i.test(message)
  )).toEqual([]);
}

test.describe.serial("Composer development file-provider fixture", () => {
  test.beforeAll(async () => {
    fixtureSandbox = await mkdtemp(join(tmpdir(), "zudo-sg-composer-e2e-"));
    backupRoot = join(fixtureSandbox, "preserved-compositions");
    try {
      hadExistingOutput = (await stat(outputRoot)).isDirectory();
    } catch {
      hadExistingOutput = false;
    }
    if (hadExistingOutput) {
      await cp(outputRoot, backupRoot, { recursive: true, preserveTimestamps: true });
    }
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });
  });

  test.afterAll(async () => {
    await rm(outputRoot, { recursive: true, force: true });
    if (hadExistingOutput) {
      await cp(backupRoot, outputRoot, { recursive: true, preserveTimestamps: true });
    }
    await rm(fixtureSandbox, { recursive: true, force: true });
  });

  test("canonical JSON and production JSX stay exact through create, update, and repair", async ({ page }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await resetComposerPersistence(page);
    await openComposerLibrary(page);
    await expect(page.getByLabel("Provider").locator("option")).toHaveText([
      "Browser storage",
      "Local files",
    ]);
    await selectFilesProvider(page);
    await page.getByRole("button", { name: "New composition" }).first().click();
    await expect(page).toHaveURL(/#\/composition\/files\/[^/]+$/);
    const id = decodeURIComponent(page.url().split("/").at(-1) ?? "");
    const jsonPath = resolve(outputRoot, `composition-${id}.composition.json`);
    const jsxPath = resolve(outputRoot, `composition-${id}.tsx`);

    const canonical = JSON.parse(await waitForFile(jsonPath));
    expect(canonical).toMatchObject({ id, document: { id, name: "Product overview" } });
    expect(`${JSON.stringify(canonical, null, 2)}\n`).toBe(await readFile(jsonPath, "utf8"));

    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const exportCode = await page.getByRole("dialog", { name: /Export/ }).locator("pre code").textContent();
    expect(await waitForFile(jsxPath)).toBe(exportCode);
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Add component to document root" }).click();
    const chooser = page.locator("dialog.sg-composer-chooser");
    await chooser.getByPlaceholder("Search components…").fill("Callout");
    await chooser.getByRole("button", { name: "Callout", exact: true }).click();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
    await expect.poll(async () => JSON.parse(await readFile(jsonPath, "utf8")).document.root.length).toBe(2);

    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const updatedExport = await page.getByRole("dialog", { name: /Export/ }).locator("pre code").textContent();
    expect(await readFile(jsxPath, "utf8")).toBe(updatedExport);
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await unlink(jsxPath);
    await page.reload();
    await expect(page.frameLocator(COMPOSER_CANVAS_IFRAME).locator("[data-composer-canvas]")).toBeVisible();
    expect(await waitForFile(jsxPath)).toBe(updatedExport);

    await writeFile(jsxPath, "stale derived artifact\n");
    await writeFile(resolve(outputRoot, `.composition-${id}.interrupted.tmp`), "interrupted");
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Composition library" })).toBeVisible();
    expect(await waitForFile(jsxPath)).toBe(updatedExport);
    expect(await readFile(resolve(outputRoot, `.composition-${id}.interrupted.tmp`), "utf8"))
      .toBe("interrupted");
    expectNoUnexpectedErrors(errors);
  });

  test("delete and clear remove only owned pairs and transport failure retains the old provider state", async ({ page }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    await writeFile(resolve(outputRoot, "unrelated.txt"), "preserve me");
    await openComposerLibrary(page);

    // A failed switch is rolled back: the Browser storage collection remains
    // active and its provider-qualified route is not replaced by Files.
    await page.route("**/__zudo_composer_file_provider", (route) => route.abort("failed"));
    await page.getByLabel("Provider").selectOption("files");
    await expect(page.getByRole("alert")).toContainText(/unavailable|failed|retry/i);
    await expect(page.getByText("Active database:")).toContainText("IndexedDB");
    await page.unroute("**/__zudo_composer_file_provider");

    await selectFilesProvider(page);
    const rows = page.locator(".sg-composer-library-row");
    if (await rows.count()) {
      const openButton = rows.first().locator(".sg-composer-library-open");
      const name = (await openButton.locator(".sg-composer-library-row-name").textContent()) ?? "";
      await rows.first().getByRole("button", { name: new RegExp(`^Delete ${name}$`) }).click();
      await page.getByRole("button", { name: "Delete composition", exact: true }).click();
    }

    await page.getByRole("button", { name: "New composition" }).first().click();
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "New composition" }).first().click();
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "Clear library", exact: true }).click();
    await page.getByRole("button", { name: "Clear library", exact: true }).last().click();
    await expect(page.getByRole("heading", { name: "No compositions yet" })).toBeVisible();
    expect(await outputNames()).toEqual(expect.arrayContaining(["unrelated.txt"]));
    await expect.poll(async () =>
      (await outputNames()).filter((name) => /^composition-.*\.(?:composition\.json|tsx)$/.test(name))
    ).toEqual([]);
    expectNoUnexpectedErrors(errors);
  });
});
