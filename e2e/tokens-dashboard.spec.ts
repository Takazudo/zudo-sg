import { expect, test, type Locator, type Page } from "@playwright/test";

const TOKENS_PATH = "/components/tokens";
const PREVIEW_STATE_KEY = "sg-preview-tweak-state-v4";
const DOC_STATE_KEY = "sg-doc-tweak-state-v4";
const COLOR_SENTINEL = "oklch(0.42 0.18 210)";

function dashboard(page: Page, mode: "light" | "dark"): Locator {
  return page.locator(
    `#ui-defaults-${mode}.zdtp-dashboard[data-mode="${mode}"]`,
  );
}

function tokenRow(dashboardRoot: Locator, cssVar: string): Locator {
  return dashboardRoot.locator(`[data-css-var="${cssVar}"]`);
}

async function computedBackground(element: Locator): Promise<string> {
  return element.evaluate((node) => getComputedStyle(node).backgroundColor);
}

async function rulerWidth(dashboardRoot: Locator): Promise<number> {
  return tokenRow(dashboardRoot, "--spacing-hsp-md")
    .locator(".zdtp-dashboard__sample--bar")
    .evaluate((node) => node.getBoundingClientRect().width);
}

async function openPanel(page: Page, eventName: string): Promise<Locator> {
  await page.evaluate((name) => {
    window.dispatchEvent(new CustomEvent(name));
  }, eventName);
  const panel = page.locator(".tokenpanel-shell").first();
  await expect(panel).toBeVisible({ timeout: 10_000 });
  return panel;
}

async function setPanelValue(
  page: Page,
  panel: Locator,
  tabName: string,
  label: string,
  value: string,
): Promise<void> {
  const tab = panel.getByRole("tab", { name: tabName, exact: true });
  await expect(tab).toBeVisible({ timeout: 5_000 });
  await tab.click();

  const input = panel.getByLabel(label);
  await expect(input).toBeVisible({ timeout: 3_000 });
  await input.fill(value);
  await input.dispatchEvent("input");
  await page.waitForTimeout(150);
}

async function closePanel(page: Page, panel: Locator): Promise<void> {
  const close = panel.getByRole("button", { name: "Close panel", exact: true });
  await expect(close).toBeVisible({ timeout: 3_000 });
  await close.click();
  await expect(panel).not.toBeVisible({ timeout: 3_000 });
}

async function readPersistedState(
  page: Page,
  key: string,
): Promise<Record<string, unknown>> {
  await expect
    .poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), key), {
      timeout: 5_000,
    })
    .not.toBeNull();

  const raw = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  if (raw === null) throw new Error(`Expected persisted state at ${key}`);
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Persisted state at ${key} is not an object`);
  }
  return parsed as Record<string, unknown>;
}

function isOpaqueColor(color: string): boolean {
  const normalized = color.trim().toLowerCase();
  return normalized !== "" && normalized !== "transparent" && !(
    /rgba?\([^)]*(?:,\s*0(?:\D|$)|\/\s*0)\s*\)/.test(normalized) ||
    /hsla?\([^)]*(?:,\s*0(?:\D|$)|\/\s*0)\s*\)/.test(normalized)
  );
}

test("JS-off desktop renders both declared dashboards and their reference geometry", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(TOKENS_PATH);
    expect(response?.status()).toBe(200);

    const light = dashboard(page, "light");
    const dark = dashboard(page, "dark");
    await expect(light).toBeAttached();
    await expect(dark).toBeAttached();
    await expect(light.locator("[data-css-var]")).toHaveCount(102);
    await expect(dark.locator("[data-css-var]")).toHaveCount(102);

    expect(await rulerWidth(light)).toBe(12);

    const neutralNames = await light
      .locator(".zdtp-dashboard__palette")
      .first()
      .locator("[data-css-var]")
      .evaluateAll((rows) => rows.slice(0, 4).map((row) => row.getAttribute("data-css-var")));
    expect(neutralNames).toEqual([
      "--palette-neutral-0",
      "--palette-neutral-1",
      "--palette-neutral-2",
      "--palette-neutral-3",
    ]);

    const lightAccent = tokenRow(light, "--color-accent").locator(
      ".zdtp-dashboard__sample--color",
    );
    const darkAccent = tokenRow(dark, "--color-accent").locator(
      ".zdtp-dashboard__sample--color",
    );
    const lightAccentColor = await computedBackground(lightAccent);
    const darkAccentColor = await computedBackground(darkAccent);
    expect(isOpaqueColor(lightAccentColor)).toBe(true);
    expect(isOpaqueColor(darkAccentColor)).toBe(true);
    expect(lightAccentColor).not.toBe(darkAccentColor);

    const typographySpecimen = light
      .locator(".zdtp-dashboard__preview--typography .zdtp-dashboard__sample")
      .first();
    const specimenBox = await typographySpecimen.boundingBox();
    expect(specimenBox?.height ?? 0).toBeGreaterThan(18 * 1.6);

    expect(
      await light.evaluate((root) => getComputedStyle(root).borderRadius),
    ).toBe("10px");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("JS-off 360px keeps the dashboards in bounds and exposes a keyboard-scrollable strip", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 360, height: 740 },
  });
  const page = await context.newPage();

  try {
    await page.goto(TOKENS_PATH);
    const light = dashboard(page, "light");
    const dark = dashboard(page, "dark");
    await expect(light).toBeAttached();
    await expect(dark).toBeAttached();
    await expect(light.locator("[data-css-var]")).toHaveCount(102);
    await expect(dark.locator("[data-css-var]")).toHaveCount(102);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const strip = light
      .locator('.zdtp-dashboard__palette-scroll[role="region"][tabindex="0"]')
      .first();
    await expect(strip).toHaveCount(1);
    const beforeGeometry = await strip.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      scrollLeft: node.scrollLeft,
    }));
    expect(beforeGeometry.scrollWidth).toBeGreaterThan(beforeGeometry.clientWidth);

    await strip.focus();
    await expect(strip).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => strip.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(beforeGeometry.scrollLeft);
  } finally {
    await context.close();
  }
});

test("dashboard defaults stay isolated from saved preview and doc-chrome panel state", async ({
  page,
}) => {
  await page.goto(TOKENS_PATH);
  const light = dashboard(page, "light");
  await expect(light).toBeAttached();

  const accentSample = tokenRow(light, "--color-accent").locator(
    ".zdtp-dashboard__sample--color",
  );
  const declaredAccent = await computedBackground(accentSample);
  expect(
    await page.locator("html").evaluate((root) => (root as HTMLElement).style.getPropertyValue("--color-bg")),
  ).toBe("");

  const previewPanel = await openPanel(page, "toggle-preview-token-panel");
  await setPanelValue(
    page,
    previewPanel,
    "Color",
    "--color-accent value",
    COLOR_SENTINEL,
  );
  expect(await computedBackground(accentSample)).toBe(declaredAccent);

  const previewState = await readPersistedState(page, PREVIEW_STATE_KEY);
  expect(previewState).toMatchObject({
    tabs: {
      "ui-color": {
        accent: { "ui-color-accent": COLOR_SENTINEL },
      },
    },
  });
  await closePanel(page, previewPanel);

  await page.reload();
  await expect(light).toBeAttached();
  expect(
    await computedBackground(
      tokenRow(dashboard(page, "light"), "--color-accent").locator(
        ".zdtp-dashboard__sample--color",
      ),
    ),
  ).toBe(declaredAccent);
  const reloadedPreviewPanel = await openPanel(page, "toggle-preview-token-panel");
  await reloadedPreviewPanel.getByRole("tab", { name: "Color", exact: true }).click();
  await expect(reloadedPreviewPanel.getByLabel("--color-accent value")).toHaveValue(
    COLOR_SENTINEL,
  );
  await closePanel(page, reloadedPreviewPanel);

  await page.reload();
  const docPanel = await openPanel(page, "toggle-sg-doc-tweak");
  await setPanelValue(page, docPanel, "Spacing", "--spacing-hsp-md value", "2.25");
  const docState = await readPersistedState(page, DOC_STATE_KEY);
  expect(docState).toMatchObject({ spacing: { "hsp-md": "2.25rem" } });
  await closePanel(page, docPanel);

  await page.reload();
  const reloadedDocPanel = await openPanel(page, "toggle-sg-doc-tweak");
  await reloadedDocPanel.getByRole("tab", { name: "Spacing", exact: true }).click();
  await expect(reloadedDocPanel.getByLabel("--spacing-hsp-md value")).toHaveValue("2.25");
  await closePanel(page, reloadedDocPanel);

  const postDocDashboard = dashboard(page, "light");
  expect(
    await computedBackground(
      tokenRow(postDocDashboard, "--color-accent").locator(
        ".zdtp-dashboard__sample--color",
      ),
    ),
  ).toBe(declaredAccent);
  expect(await rulerWidth(postDocDashboard)).toBe(12);

  await page.evaluate(() => localStorage.clear());
});

test("live token clicks copy real values while declared dashboards stay outside the live area", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(TOKENS_PATH);

  const liveRoot = page.locator("[data-sg-tokens-root]");
  await expect(liveRoot.locator(".zdtp-dashboard")).toHaveCount(0);
  const firstToken = liveRoot.locator("[data-sg-token]").first();
  await expect(firstToken).toBeVisible();
  const varName = await firstToken.getAttribute("data-var");
  expect(varName).toMatch(/^--[a-z0-9-]+$/);

  await firstToken.click();
  const toast = page.locator('.sg-token-toast[data-visible="true"]');
  await expect(toast).toBeVisible();
  const resolvedValue = await page.evaluate(() => navigator.clipboard.readText());
  expect(resolvedValue.trim()).not.toBe("");
  expect(resolvedValue).not.toMatch(/^var\(/);

  const copyFormat = page.getByRole("group", { name: "Copy format" });
  const varMode = copyFormat.getByRole("button", { name: "var(--token)", exact: true });
  await varMode.click();
  await expect(varMode).toHaveAttribute("aria-pressed", "true");
  await firstToken.click();
  await expect(toast).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(`var(${varName})`);

  for (const mode of ["light", "dark"] as const) {
    const rows = dashboard(page, mode).locator("[data-css-var]");
    await expect(rows).toHaveCount(102);
    expect(
      await rows.evaluateAll((elements) =>
        elements.some((element) => element.hasAttribute("data-sg-token")),
      ),
    ).toBe(false);
    expect(
      await rows.evaluateAll((elements) =>
        elements.some((element) => (element.getAttribute("title") ?? "").startsWith("Click to copy")),
      ),
    ).toBe(false);
  }
});

test("client navigation preserves the document and mounts both dashboards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/components");
  await page.evaluate(() => {
    (window as Window & { __sgSpaMarker?: boolean }).__sgSpaMarker = true;
  });

  const swapped = page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("Timed out waiting for zfb:after-swap")),
          10_000,
        );
        document.addEventListener(
          "zfb:after-swap",
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      }),
  );
  const tokensLink = page.locator('#desktop-sidebar a[href="/components/tokens"]');
  await expect(tokensLink).toBeVisible();
  await tokensLink.click();
  await swapped;

  expect(
    await page.evaluate(
      () => (window as Window & { __sgSpaMarker?: boolean }).__sgSpaMarker,
    ),
  ).toBe(true);
  const light = dashboard(page, "light");
  const dark = dashboard(page, "dark");
  await expect(light).toBeAttached();
  await expect(dark).toBeAttached();
  await expect(light.locator("[data-css-var]")).toHaveCount(102);
  expect(
    await light.evaluate((root) => getComputedStyle(root).borderRadius),
  ).toBe("10px");
});

test("blocking the combined stylesheet leaves dashboard HTML but removes its style contract", async ({
  page,
}) => {
  let stylesheetHits = 0;
  await page.route("**/styles-*.css", async (route) => {
    stylesheetHits += 1;
    await route.abort();
  });

  await page.goto(TOKENS_PATH);
  const light = dashboard(page, "light");
  await expect(light).toBeAttached();
  await expect(light.locator("[data-css-var]")).toHaveCount(102);
  expect(
    await light.evaluate((root) => getComputedStyle(root).borderRadius),
  ).not.toBe("10px");
  expect(stylesheetHits).toBeGreaterThan(0);

  await page.unroute("**/styles-*.css");
  await page.reload();
  await expect(light).toBeAttached();
  expect(
    await light.evaluate((root) => getComputedStyle(root).borderRadius),
  ).toBe("10px");
});

test("site theme changes the host while each dashboard keeps its own chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(TOKENS_PATH);
  const light = dashboard(page, "light");
  const dark = dashboard(page, "dark");
  await expect(light).toBeAttached();
  await expect(dark).toBeAttached();

  const html = page.locator("html");
  const themeToggle = page.locator('button[aria-label^="Switch to "]:visible').first();
  await expect(themeToggle).toBeVisible();
  const currentTheme = await html.getAttribute("data-theme");
  if (currentTheme !== "light") {
    await themeToggle.click();
    await expect(html).toHaveAttribute("data-theme", "light");
  }

  const hostLightBackground = await page.locator("body").evaluate(
    (body) => getComputedStyle(body).backgroundColor,
  );
  const dashboardChrome = await computedBackground(light);

  await themeToggle.click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() =>
      html.evaluate((root) => getComputedStyle(root).colorScheme),
    )
    .toBe("dark");
  await expect
    .poll(() => page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor))
    .not.toBe(hostLightBackground);

  expect(await computedBackground(light)).toBe(dashboardChrome);
  expect(await computedBackground(dark)).toBe(dashboardChrome);
  const darkInventory = dark.locator(".zdtp-dashboard__inventory");
  expect(
    await darkInventory.evaluate((inventory) => getComputedStyle(inventory).colorScheme),
  ).toBe("dark");
});
