import { expect, test, type FrameLocator, type Page } from "@playwright/test";

async function frameBackground(frame: FrameLocator): Promise<string> {
  return frame
    .locator("body")
    .evaluate((body) => getComputedStyle(body).backgroundColor);
}

async function frameColorScheme(frame: FrameLocator): Promise<string> {
  return frame
    .locator(":root")
    .evaluate((root) => getComputedStyle(root).colorScheme);
}

async function clickAndWaitForSwap(page: Page, selector: string): Promise<void> {
  const swapped = page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
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
    });
  });
  await page.locator(selector).click();
  await swapped;
}

test("desktop preview uses an honest 1280px viewport with keyboard-reachable edges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 720 });

  const response = await page.goto("/components/cta-button");
  expect(response?.status()).toBe(200);

  const iframe = page
    .locator('iframe[src*="/components/preview"]')
    .first();
  await expect(iframe).toBeAttached({ timeout: 15_000 });

  const viewportToolbar = page.getByRole("group", {
    name: "Preview viewport",
  }).first();
  await viewportToolbar.getByRole("button", { name: "Desktop" }).click();

  await expect
    .poll(() => iframe.contentFrame().locator(":root").evaluate(() => innerWidth))
    .toBe(1280);

  const scroller = page
    .getByRole("region", { name: "Preview viewport canvas" })
    .first();
  await expect(scroller).toHaveAttribute("tabindex", "0");

  await viewportToolbar.getByRole("button", { name: "Full" }).focus();
  await page.keyboard.press("Tab");
  await expect(scroller).toBeFocused();

  const geometry = await scroller.evaluate((element) => {
    const frame = element.querySelector("iframe");
    if (!frame) throw new Error("Preview iframe not found");

    element.scrollLeft = 0;
    const containerRect = element.getBoundingClientRect();
    const leftEdge = frame.getBoundingClientRect().left;

    element.scrollLeft = element.scrollWidth;
    const rightEdge = frame.getBoundingClientRect().right;

    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      leftEdge,
      rightEdge,
      containerLeft: containerRect.left,
      containerRight: containerRect.right,
      maxScrollLeft: element.scrollLeft,
    };
  });

  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  expect(geometry.maxScrollLeft).toBeGreaterThan(0);
  expect(geometry.leftEdge).toBeGreaterThanOrEqual(geometry.containerLeft);
  expect(geometry.rightEdge).toBeLessThanOrEqual(geometry.containerRight);
});

test("per-frame themes support Follow, pinning, preserved state, and SPA resynchronization", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const response = await page.goto("/components/cta-button");
  expect(response?.status()).toBe(200);

  const iframeElements = page.locator('iframe[src*="/components/preview"]');
  await expect(iframeElements).toHaveCount(2, { timeout: 15_000 });
  await iframeElements.nth(0).scrollIntoViewIfNeeded();
  await iframeElements.nth(1).scrollIntoViewIfNeeded();

  const firstFrame = page
    .frameLocator('iframe[src*="/components/preview"]')
    .nth(0);
  const secondFrame = page
    .frameLocator('iframe[src*="/components/preview"]')
    .nth(1);
  const themeGroups = page.getByRole("group", { name: "Preview theme" });
  await expect(themeGroups).toHaveCount(2);

  const catalogTheme = await page.locator("html").getAttribute("data-theme");
  expect(catalogTheme === "light" || catalogTheme === "dark").toBe(true);
  const oppositeTheme = catalogTheme === "dark" ? "Light" : "Dark";

  await expect(
    themeGroups.nth(0).getByRole("button", { name: "Follow catalog" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => frameColorScheme(firstFrame))
    .toBe(catalogTheme);
  await themeGroups.nth(1).getByRole("button", { name: oppositeTheme }).click();
  await expect
    .poll(() => frameColorScheme(secondFrame))
    .toBe(oppositeTheme.toLowerCase());

  const followBeforeToggle = await frameBackground(firstFrame);
  const pinnedBeforeToggle = await frameBackground(secondFrame);
  expect(followBeforeToggle).not.toBe(pinnedBeforeToggle);

  // Record iframe-local state so any hidden reload caused by a theme change is
  // observable, and edit a live story control before toggling themes.
  await firstFrame.locator(":root").evaluate((root) => {
    (root as HTMLElement & { __themeControlMarker__?: string }).__themeControlMarker__ =
      "preserved";
  });
  const labelControl = page.getByLabel("Label").first();
  await labelControl.fill("Theme state stays live");
  const heightBeforeToggle = await iframeElements
    .nth(0)
    .evaluate((frame) => frame.style.height);

  const catalogToggle = page
    .locator('button[aria-label^="Switch to "]:visible')
    .first();
  await expect(catalogToggle).toBeVisible();
  await catalogToggle.click();

  await expect
    .poll(() => frameBackground(firstFrame))
    .not.toBe(followBeforeToggle);
  expect(await frameBackground(secondFrame)).toBe(pinnedBeforeToggle);
  await expect(labelControl).toHaveValue("Theme state stays live");
  expect(await iframeElements.nth(0).evaluate((frame) => frame.style.height)).toBe(
    heightBeforeToggle,
  );
  expect(
    await firstFrame.locator(":root").evaluate(
      (root) =>
        (root as HTMLElement & { __themeControlMarker__?: string })
          .__themeControlMarker__,
    ),
  ).toBe("preserved");

  // Returning the pinned frame to Follow immediately converges it to the
  // catalog without replacing the iframe.
  await themeGroups
    .nth(1)
    .getByRole("button", { name: "Follow catalog" })
    .click();
  await expect
    .poll(() => frameBackground(secondFrame))
    .toBe(await frameBackground(firstFrame));

  // Navigate through the real client router. The next page's newly mounted
  // Follow frame must receive the concrete catalog theme after readiness.
  const expectedAfterNavigation = await frameBackground(firstFrame);
  await clickAndWaitForSwap(
    page,
    '#desktop-sidebar a[href="/components/input"]',
  );
  const navigatedIframe = page
    .locator('iframe[src*="/components/preview"]')
    .first();
  await expect(navigatedIframe).toBeAttached({ timeout: 15_000 });
  await navigatedIframe.scrollIntoViewIfNeeded();
  const navigatedFrame = page
    .frameLocator('iframe[src*="/components/preview"]')
    .first();
  await expect
    .poll(() => frameBackground(navigatedFrame))
    .toBe(expectedAfterNavigation);
});
