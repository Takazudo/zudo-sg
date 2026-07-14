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
import {
  boundConsumerRecord,
  globalTemplateRecord,
  reuseDocument,
} from "./support/composer-reuse";

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

async function expectFileContents(path: string, expected: string): Promise<void> {
  await expect.poll(async () => {
    try {
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  }).toBe(expected);
}

function fileModuleFromBrowserExport(browserExport: string | null): string {
  expect(browserExport).toMatch(/^export function [A-Za-z_$][\w$]*\(\)/m);
  return browserExport!.replace(/^export function [A-Za-z_$][\w$]*\(\)/m, "export default function Composition()");
}

async function selectFilesProvider(page: Page): Promise<void> {
  await page.getByLabel("Provider").selectOption("files");
  await expect(page.getByText("Active database:")).toContainText("Development composition files");
}

async function createOrdinaryFileComposition(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "New composition" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New composition" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: /None/ }).click();
  await dialog.getByRole("button", { name: "Create composition" }).click();
  await expect(page).toHaveURL(/#\/composition\/files\/[^/]+$/);
  return decodeURIComponent(page.url().split("/").at(-1) ?? "");
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
    const id = await createOrdinaryFileComposition(page, "Product overview");
    const jsonPath = resolve(outputRoot, `composition-${id}.composition.json`);
    const jsxPath = resolve(outputRoot, `composition-${id}.tsx`);

    const canonical = JSON.parse(await waitForFile(jsonPath));
    expect(canonical).toMatchObject({ id, document: { id, name: "Product overview", root: [] } });
    expect(`${JSON.stringify(canonical, null, 2)}\n`).toBe(await readFile(jsonPath, "utf8"));

    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const exportCode = await page.getByRole("dialog", { name: /Export/ }).locator("pre code").textContent();
    await expectFileContents(jsxPath, fileModuleFromBrowserExport(exportCode));
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Add component to document root" }).click();
    const chooser = page.locator("dialog.sg-composer-chooser");
    await chooser.getByPlaceholder("Search components…").fill("Callout");
    await chooser.getByRole("button", { name: "Callout", exact: true }).click();
    await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
    await expect.poll(async () => JSON.parse(await readFile(jsonPath, "utf8")).document.root.length).toBe(1);

    await page.getByRole("button", { name: "Export JSX", exact: true }).click();
    const updatedExport = await page.getByRole("dialog", { name: /Export/ }).locator("pre code").textContent();
    const updatedModule = fileModuleFromBrowserExport(updatedExport);
    await expectFileContents(jsxPath, updatedModule);
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await unlink(jsxPath);
    await page.reload();
    await expect(page.frameLocator(COMPOSER_CANVAS_IFRAME).locator("[data-composer-canvas]")).toBeVisible();
    await expectFileContents(jsxPath, updatedModule);

    await writeFile(jsxPath, "stale derived artifact\n");
    await writeFile(resolve(outputRoot, `.composition-${id}.interrupted.tmp`), "interrupted");
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Composition library" })).toBeVisible();
    await expectFileContents(jsxPath, updatedModule);
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

    await createOrdinaryFileComposition(page, "Clear library first");
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await createOrdinaryFileComposition(page, "Clear library second");
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

  test("linked Global templates write source-first Files modules without copying their shell into consumer JSON", async ({
    page,
  }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    const source = globalTemplateRecord("file-site-shell", "File site shell");
    const consumer = boundConsumerRecord("file-linked-consumer", "File linked consumer", source.id);
    const sourceJson = resolve(outputRoot, `composition-${source.id}.composition.json`);
    const consumerJson = resolve(outputRoot, `composition-${consumer.id}.composition.json`);
    const sourceTsx = resolve(outputRoot, `composition-${source.id}.tsx`);
    const consumerTsx = resolve(outputRoot, `composition-${consumer.id}.tsx`);

    await writeFile(sourceJson, `${JSON.stringify(source, null, 2)}\n`);
    await writeFile(consumerJson, `${JSON.stringify(consumer, null, 2)}\n`);
    await resetComposerPersistence(page);
    await openComposerLibrary(page);
    await selectFilesProvider(page);

    await expect(page.getByRole("button", { name: "Open File site shell" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open File linked consumer" })).toBeVisible();
    const [sourceModule, consumerModule] = await Promise.all([waitForFile(sourceTsx), waitForFile(consumerTsx)]);
    expect(sourceModule).toContain("outlets");
    expect(consumerModule).toContain('import LinkedTemplate from "./composition-file-site-shell";');
    expect(consumerModule).toContain('"main-content": <LocalCompositionContent />');

    const canonicalConsumer = JSON.parse(await readFile(consumerJson, "utf8"));
    expect(reuseDocument(canonicalConsumer)).toMatchObject({
      binding: { sourceRecordId: "file-site-shell", outletId: "main-content" },
      root: [],
    });
    expect(JSON.stringify(canonicalConsumer)).not.toContain("Original source heading");

    // The normal source deletion path is provider-guarded even in Files mode.
    await page.getByRole("button", { name: "Delete File site shell" }).click();
    await page.getByRole("button", { name: "Delete composition", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open File site shell" })).toBeVisible();
    await expect.poll(async () => (await stat(sourceJson)).isFile()).toBe(true);
    expectNoUnexpectedErrors(errors);
  });
});
