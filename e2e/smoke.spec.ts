import { expect, test } from "@playwright/test";

// T1 smoke: verify the built site renders without JS errors.
// Intentionally minimal — a single page load that confirms:
//   1. The root page returns HTTP 200 and visible content.
//   2. No JavaScript runtime errors (console.error from missing favicon/img
//      files on the scaffold are 404 resource errors, not JS errors; we filter
//      those to avoid false failures until public assets ship).
//   3. A docs content page returns 200.
// Deeper interactive flows belong in dedicated T1 specs added later.

// Scaffold has no favicons/logo yet. Filter known 404 resource warnings so
// the smoke test does not fail on scaffold-level missing static assets.
// Remove this filter once real favicon + logo assets are added.
function isScaffoldResourceError(msg: string): boolean {
  return (
    msg.includes("/favicon") ||
    msg.includes("/img/logo.svg") ||
    msg.includes("404 (Not Found)")
  );
}

test("home page renders without JavaScript errors", async ({ page }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => {
    jsErrors.push(err.message);
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await page.waitForLoadState("networkidle");

  // Confirm visible content rendered (body has meaningful text)
  const bodyText = await page.textContent("body");
  expect(bodyText?.length).toBeGreaterThan(50);

  // No uncaught JavaScript errors (distinct from 404 resource warnings)
  expect(jsErrors).toEqual([]);
});

test("getting-started docs page returns 200", async ({ page }) => {
  // /docs/ has no index.html on the scaffold (trailingSlash: false, no root
  // docs index page). Navigate to the first real docs page instead.
  const response = await page.goto("/docs/getting-started");
  expect(response?.status()).toBe(200);

  // Confirm a heading is present
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();
});
