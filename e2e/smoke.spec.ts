import { expect, test } from "@playwright/test";

// T1 smoke: verify the built site renders without JS errors.
// Intentionally minimal — a single page load that confirms:
//   1. The root page returns HTTP 200 and visible content.
//   2. No JavaScript runtime errors.
//   3. No failed (>= 400) same-origin resource requests — the home hero masks
//      /img/logo.svg and the <head> links the favicon set, so a missing brand
//      asset surfaces here (#123).
//   4. A docs content page returns 200.
// Deeper interactive flows belong in dedicated T1 specs added later.

test("home page renders without JS errors or failed asset requests", async ({ page }) => {
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => {
    jsErrors.push(err.message);
  });

  // 404 detection (#123): real favicon + logo assets now ship in public/, so any
  // >= 400 response is a genuine regression (a missing asset), not scaffold
  // noise. This replaces the former unused isScaffoldResourceError() filter,
  // which silently tolerated every 404. The home route exercises both the
  // favicon links (<head>) and the /img/logo.svg CSS mask (hero), so removing
  // or renaming either asset fails this test.
  const failedResponses: string[] = [];
  page.on("response", (res) => {
    if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`);
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await page.waitForLoadState("networkidle");

  // Confirm visible content rendered (body has meaningful text)
  const bodyText = await page.textContent("body");
  expect(bodyText?.length).toBeGreaterThan(50);

  // No uncaught JavaScript errors.
  expect(jsErrors).toEqual([]);
  // No missing static assets (favicon set + hero logo mask).
  expect(failedResponses).toEqual([]);
});

test("guide docs page returns 200", async ({ page }) => {
  // /docs/ has no index.html on the scaffold (trailingSlash: false, no root
  // docs index page). Navigate to the first real docs page instead.
  const response = await page.goto("/docs/guide");
  expect(response?.status()).toBe(200);

  // Confirm a heading is present
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();
});

// ── Styleguide /components routes ────────────────────────────────────────────
// Wave 2 (#49): smoke checks for the component catalog, a detail page,
// the token playground, and at least one preview iframe load.

test("/components catalog renders and includes the filter island marker", async ({ page }) => {
  const response = await page.goto("/components");
  expect(response?.status()).toBe(200);

  // The page heading should be visible (server-rendered).
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();

  // The SSR catalog grid should be present (filter island hangs off it).
  const catalog = page.locator("[data-sg-catalog]");
  await expect(catalog).toBeAttached();

  // At least one component card should be present.
  const firstCard = page.locator("[data-sg-card]").first();
  await expect(firstCard).toBeAttached();
});

test("/components/<slug> detail page renders with code panel aside", async ({ page }) => {
  // Navigate to the catalog first to find a valid story slug via a card link.
  await page.goto("/components");
  const firstCard = page.locator("[data-sg-card]").first();
  await expect(firstCard).toBeAttached();

  // Extract the href to navigate to the first detail page.
  const href = await firstCard.getAttribute("href");
  expect(href).toBeTruthy();

  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);

  // The story title h1 should be visible.
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();

  // The #sg-code-panel aside should be present in the SSR output.
  const codePanel = page.locator("#sg-code-panel");
  await expect(codePanel).toBeAttached();
});

test("/components/<slug> code panel updates when switching variant tabs", async ({ page }) => {
  // Regression test for #105: SourceEditor created its CodeMirror view once
  // and never diffed `value`, so switching variant tabs kept showing the
  // first variant's source. Button has two variants (Playground, Variants)
  // with distinct `source` text — a stable target for this check.
  const response = await page.goto("/components/button");
  expect(response?.status()).toBe(200);

  const codePanel = page.locator("#sg-code-panel");
  await expect(codePanel).toBeAttached();

  // The read-only source view is the FIRST CodeMirror instance in the panel
  // (the editable Live CSS buffer is the second).
  const sourceCode = codePanel.locator(".cm-content").first();

  // Select tabs by name rather than assuming a default: variants render in
  // export-name order, which for an ES module namespace is alphabetical (so the
  // initially-selected tab is "As link", not "Playground"). This test targets
  // #105 — that switching tabs actually re-renders the source — so it explicitly
  // drives the switch between two tabs with distinct source. (Default-tab
  // ordering itself is tracked separately, see #128.)
  await codePanel.getByRole("tab", { name: "Playground" }).click();
  await expect(sourceCode).toContainText('size="md"', { timeout: 15_000 });

  await codePanel.getByRole("tab", { name: "Variants" }).click();

  await expect(sourceCode).toContainText("Secondary", { timeout: 15_000 });
  await expect(sourceCode).not.toContainText('size="md"');
});

test("/components/<slug> detail page preview iframe loads", async ({ page }) => {
  // Navigate to the catalog first to find a valid slug.
  await page.goto("/components");
  const firstCard = page.locator("[data-sg-card]").first();
  const href = await firstCard.getAttribute("href");
  expect(href).toBeTruthy();

  await page.goto(href!);

  // Wait for at least one preview iframe to appear (VariantFrame is
  // `when="visible"` — it hydrates on viewport intersection).
  const iframe = page.locator('iframe[src*="/components/preview"]').first();
  await expect(iframe).toBeAttached({ timeout: 15_000 });
});

test("/components/tokens renders design-token playground", async ({ page }) => {
  const response = await page.goto("/components/tokens");
  expect(response?.status()).toBe(200);

  // The page heading should be visible.
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();

  // The SSR token-grid root should be present (TokenPlayground island
  // delegates click events against it).
  const tokensRoot = page.locator("[data-sg-tokens-root]");
  await expect(tokensRoot).toBeAttached();

  // At least one token swatch (color section) should be rendered SSR.
  const firstToken = page.locator("[data-sg-token]").first();
  await expect(firstToken).toBeAttached();
});
