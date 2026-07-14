import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  COMPOSER_CANVAS_IFRAME,
  captureUnexpectedBrowserErrors,
  openComposerLibrary,
  openComposerRecord,
  prepareLegacyMigration,
  resetComposerPersistence,
} from "./support/composer-persistence";

const THEME_KEY = "zudo-doc-theme";
const WIDTHS = [390, 768, 1024, 1280] as const;
const THEMES = ["light", "dark"] as const;

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: THEME_KEY,
    value: theme,
  });
}

async function assertTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toContain(theme);
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.root, "documentElement must not overflow horizontally")
    .toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body, "body must not overflow horizontally")
    .toBeLessThanOrEqual(dimensions.viewport);
}

async function assertNamedKeyboardControls(scope: Locator): Promise<void> {
  const controls = scope.locator(
    'button:visible, input:visible, select:visible, textarea:visible, [role="menuitem"]:visible, [tabindex]:visible',
  );
  const count = await controls.count();
  expect(count, "the checked surface must expose keyboard controls").toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    await expect(control, `control ${index} must have an accessible name`).toHaveAccessibleName(/\S/);
    expect(
      await control.evaluate((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element instanceof HTMLButtonElement && element.disabled) return true;
        if (element instanceof HTMLInputElement && element.disabled) return true;
        if (element instanceof HTMLSelectElement && element.disabled) return true;
        return element.tabIndex >= 0;
      }),
      `control ${index} must be keyboard reachable`,
    ).toBe(true);
  }
}

async function assertTouchTargets(scope: Locator): Promise<void> {
  const controls = scope.locator("button:visible, input:visible, select:visible");
  const count = await controls.count();
  expect(count, "the checked surface must expose touch controls").toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const box = await control.boundingBox();
    expect(box, `control ${index} must have a box`).not.toBeNull();
    expect(box!.width, `control ${index} touch width`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `control ${index} touch height`).toBeGreaterThanOrEqual(44);
  }
}

async function attachCapture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  // Captures confirm the deterministic assertions above; they are deliberately
  // artifacts instead of pixel-only pass/fail baselines.
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

test.describe("Composer viewport, theme, and accessibility matrix", () => {
  test.use({ hasTouch: true });

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`${width}px ${theme}: index and loaded detail contracts`, async ({ page }, testInfo) => {
        const errors = captureUnexpectedBrowserErrors(page);
        await page.setViewportSize({ width, height: 900 });
        await setTheme(page, theme);
        await resetComposerPersistence(page);

        await openComposerLibrary(page);
        await assertTheme(page, theme);
        await assertNoPageOverflow(page);
        await assertNamedKeyboardControls(page.locator(".sg-composer-library"));
        await assertTouchTargets(page.locator(".sg-composer-library"));
        await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);
        await attachCapture(page, testInfo, `composer-index-${width}-${theme}`);

        await openComposerRecord(page);
        await assertTheme(page, theme);
        await assertNoPageOverflow(page);
        await assertNamedKeyboardControls(page.locator(".sg-composer-shell"));
        await assertTouchTargets(page.locator(".sg-composer-toolbar"));
        await expect(page.locator('.sg-composer-save-status[aria-live="polite"]')).toBeVisible();
        await expect(page.locator(".sg-composer-tree-rail")).toHaveCSS(
          "display",
          width < 1024 ? "none" : "block",
        );
        await expect(page.locator(".sg-composer-inspector")).toHaveCSS(
          "display",
          width < 1024 ? "none" : "block",
        );
        await expect(page.locator(".sg-composer-canvas")).toBeVisible();
        await expect(
          page.frameLocator(COMPOSER_CANVAS_IFRAME).locator("[data-composer-canvas]"),
        ).toBeVisible();
        await attachCapture(page, testInfo, `composer-detail-${width}-${theme}`);

        expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
      });
    }
  }
});

test.describe("Composer interaction and state semantics", () => {
  test("destructive library confirmation starts safe and restores focus", async ({ page }) => {
    await resetComposerPersistence(page);
    await openComposerLibrary(page);
    const deleteButton = page.getByRole("button", { name: /^Delete / }).first();
    await deleteButton.click();
    const confirmation = page.getByRole("group", { name: /^Confirm deleting / });
    await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(deleteButton).toBeFocused();

    await deleteButton.click();
    await confirmation.getByRole("button", { name: "Delete composition" }).click();
    await expect(page.getByRole("button", { name: "New composition" }).last()).toBeFocused();
  });

  test("filter, menu, chooser, dialog, and editor controls remain named and reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await resetComposerPersistence(page);
    await openComposerLibrary(page);
    const filter = page.getByRole("searchbox", { name: "Filter compositions" });
    await filter.fill("does-not-exist");
    await expect(page.getByRole("heading", { name: "No matching compositions" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filter" }).click();
    await openComposerRecord(page);

    const menuTrigger = page.getByRole("button", { name: /^Open menu for / }).first();
    await menuTrigger.click();
    const menu = page.getByRole("menu");
    await expect(menu).toHaveAccessibleName(/\S/);
    await assertNamedKeyboardControls(menu);
    await page.keyboard.press("Escape");
    await expect(menuTrigger).toBeFocused();

    const addButton = page.getByRole("button", { name: "Add component to document root" });
    await addButton.click();
    const chooser = page.locator("dialog.sg-composer-chooser");
    await expect(chooser).toBeVisible();
    await expect(chooser).toHaveAccessibleName(/\S/);
    await expect(chooser.getByPlaceholder("Search components…")).toBeFocused();
    await assertNamedKeyboardControls(chooser);
    await page.keyboard.press("Escape");
    await expect(chooser).not.toBeVisible();
    await expect(addButton).toBeFocused();
  });

  test("empty, not-found, recovery, and provider-failure states are actionable", async ({
    baseURL,
    browser,
    page,
  }) => {
    await resetComposerPersistence(page);
    await openComposerLibrary(page);
    await page.getByRole("button", { name: "Clear library" }).click();
    await page.getByRole("button", { name: "Clear library" }).last().click();
    await expect(page.getByRole("heading", { name: "No compositions yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New composition" }).last()).toBeEnabled();

    await page.goto("/composer/#/composition/indexeddb/missing-record");
    await expect(page.getByRole("heading", { name: "Composition could not be opened" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to library" })).toBeVisible();

    await prepareLegacyMigration(page, JSON.stringify({
      schemaVersion: 999,
      id: "future-record",
      name: "Future record",
      root: [],
    }));
    await openComposerLibrary(page);
    await expect(page.getByRole("heading", { name: "Recovery required" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry recovery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start fresh" })).toBeVisible();

    expect(baseURL, "the Composer verification config must provide a base URL").toBeTruthy();
    const unavailableContext = await browser.newContext({ baseURL });
    await unavailableContext.addInitScript(() => {
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    });
    const unavailablePage = await unavailableContext.newPage();
    await unavailablePage.goto("/composer/");
    await expect(unavailablePage.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(unavailablePage.getByRole("button", { name: "Retry library" })).toBeVisible();
    await expect(unavailablePage.getByRole("heading", { name: "Composition library unavailable" }))
      .toBeVisible();
    await unavailableContext.close();
  });
});
