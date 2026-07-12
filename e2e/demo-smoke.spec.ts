import { expect, test } from "@playwright/test";

// apps/demo smoke: verify the built demo site (Northwind) renders without JS
// errors and that the key marketing-page components composed from
// @zudo-sg/ui are present. Runs against the pre-built apps/demo/dist via the
// "demo-smoke" project (see playwright.config.ts).
//
// The demo is a single-page site (no client-side router, no islands), so
// there is no equivalent of the styleguide's multi-route smoke coverage —
// one page load is the whole surface.

test("home page renders without JavaScript errors", async ({ page }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => {
    jsErrors.push(err.message);
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await page.waitForLoadState("networkidle");

  const bodyText = await page.textContent("body");
  expect(bodyText?.length).toBeGreaterThan(50);

  expect(jsErrors).toEqual([]);
});

test("key layout landmarks are visible", async ({ page }) => {
  await page.goto("/");

  // SiteHeader renders a <header> (implicit banner landmark).
  await expect(page.getByRole("banner")).toBeVisible();

  // Hero renders the page's single <h1>.
  await expect(page.locator("h1").first()).toBeVisible();

  // SiteFooter renders a <footer> (implicit contentinfo landmark).
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("primary nav and hero CTA render", async ({ page }) => {
  await page.goto("/");

  // The ported SiteNav's global navigation landmark (aria-label="Global navigation").
  await expect(
    page.getByRole("navigation", { name: "Global navigation" }),
  ).toBeVisible();

  // Landing hero's primary CTA (from the demo landing config → /products).
  await expect(
    page.getByRole("link", { name: "ダミー分類" }).first(),
  ).toBeVisible();
});
