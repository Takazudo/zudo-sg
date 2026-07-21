import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  captureUnexpectedBrowserErrors,
  inspectComposerDatabase,
  openComposerLibrary,
  resetComposerPersistence,
} from "./support/composer-persistence";

const outputRoot = resolve(process.cwd(), "compositions");

async function outputSnapshot(): Promise<string[]> {
  try {
    return (await readdir(outputRoot)).sort();
  } catch {
    return [];
  }
}

test("built preview exposes IndexedDB but no file capability, endpoint, UI, or destination writes", async ({ page, request }) => {
  const before = await outputSnapshot();
  const errors = captureUnexpectedBrowserErrors(page);
  await resetComposerPersistence(page);
  await openComposerLibrary(page);

  const provider = page.getByLabel("Provider");
  await expect(provider.locator("option")).toHaveText(["Browser storage"]);
  await expect(provider).toBeDisabled();
  await expect(page.getByText("Active database:")).toContainText("IndexedDB: zudo-sg-composer");

  // The property under test is that the file-provider endpoint does not EXIST in a production
  // build — not any particular status code. `zfb preview` rejects POST to every path wholesale
  // (404 pre-next.79, 405 since), so pin the assertion to a control path instead of a literal
  // status: the endpoint must be indistinguishable from a path that was never routed.
  const controlPath = "/__zudo_composer_file_provider_absent_control";
  const [endpoint, control] = await Promise.all([
    request.post("/__zudo_composer_file_provider", {
      headers: { "content-type": "application/json" },
      data: { operation: "clear" },
    }),
    request.post(controlPath, {
      headers: { "content-type": "application/json" },
      data: { operation: "clear" },
    }),
  ]);
  expect(endpoint.ok()).toBe(false);
  expect(endpoint.status()).toBe(control.status());
  expect(endpoint.headers()["content-type"] ?? "").not.toContain("application/json");
  expect(await endpoint.text()).toBe(await control.text());

  await page.getByRole("button", { name: "New composition" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New composition" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Create composition", exact: true }).click();
  await expect(page).toHaveURL(/#\/composition\/indexeddb\/[^/]+$/);
  await page.reload();
  expect((await inspectComposerDatabase(page)).records).toHaveLength(2);
  expect(await outputSnapshot()).toEqual(before);
  expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
});
