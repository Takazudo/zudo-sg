import {
  expect,
  test,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

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

/**
 * Press Tab up to `maxPresses` times, returning the number of presses it took
 * for `target` to become the focused element, or -1 if it never did. Used
 * instead of a fixed single-Tab assertion because the toolbar is now
 * page-level (#541): how many controls sit between a given button and the
 * first stage is an implementation detail, not the contract under test.
 */
async function tabUntilFocused(
  page: Page,
  target: Locator,
  maxPresses: number,
): Promise<number> {
  for (let presses = 1; presses <= maxPresses; presses += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) {
      return presses;
    }
  }
  return -1;
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

  // The toolbar used to be per-frame, so Full sat immediately before its
  // frame's canvas and one Tab reached it. It is now page-level (#541), with
  // Layout, Code panel, and Preview tokens between Full and the first stage —
  // the canvas being keyboard-reachable is the invariant, not a fixed number
  // of presses.
  await viewportToolbar.getByRole("button", { name: "Full" }).focus();
  const pressesToCanvas = await tabUntilFocused(page, scroller, 10);
  expect(
    pressesToCanvas,
    "canvas should be reachable by tabbing forward from the toolbar",
  ).toBeGreaterThan(0);
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

test("the shared theme toolbar drives every frame, holds an explicit choice, and resyncs after navigation", async ({
  page,
}) => {
  // The toolbar used to be per-frame, so "per-frame themes" meant one frame
  // could be pinned to Dark while its neighbour kept Following the catalog —
  // that comparison is gone by design (#541): ONE toolbar now drives every
  // stage. What must survive is the PROTOCOL: each iframe still gets its own
  // postMessage, an explicit choice still overrides Follow and holds against
  // catalog changes, live story-control state and iframe height survive a
  // theme change (no remount), and a freshly-mounted page after SPA
  // navigation still resolves Follow against the concrete catalog theme.
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

  // One page-level control drives every stage now — there used to be one
  // "Preview theme" group per frame.
  const themeGroup = page.getByRole("group", { name: "Preview theme" });
  await expect(themeGroup).toHaveCount(1);
  await expect(
    themeGroup.getByRole("button", { name: "Follow catalog" }),
  ).toHaveAttribute("aria-pressed", "true");

  const initialCatalogTheme = await page.locator("html").getAttribute("data-theme");
  expect(initialCatalogTheme === "light" || initialCatalogTheme === "dark").toBe(
    true,
  );

  // Both frames start on Follow and resolve to the catalog's theme.
  await expect.poll(() => frameColorScheme(firstFrame)).toBe(initialCatalogTheme);
  await expect.poll(() => frameColorScheme(secondFrame)).toBe(initialCatalogTheme);

  const catalogToggle = page
    .locator('button[aria-label^="Switch to "]:visible')
    .first();
  await expect(catalogToggle).toBeVisible();

  // Toggling the site-wide theme resyncs EVERY Follow frame, not just one —
  // the per-frame protocol survived even though the control that drives it
  // moved to the page level.
  await catalogToggle.click();
  const catalogAfterFirstToggle = initialCatalogTheme === "dark" ? "light" : "dark";
  await expect
    .poll(() => frameColorScheme(firstFrame))
    .toBe(catalogAfterFirstToggle);
  await expect
    .poll(() => frameColorScheme(secondFrame))
    .toBe(catalogAfterFirstToggle);

  // Record iframe-local state and a rendered snapshot so a hidden
  // reload/remount from the next theme change would be observable, and edit a
  // live story control before switching.
  await firstFrame.locator(":root").evaluate((root) => {
    (root as HTMLElement & { __themeControlMarker__?: string }).__themeControlMarker__ =
      "preserved";
  });
  const labelControl = page.getByLabel("Label").first();
  await labelControl.fill("Theme state stays live");
  const heightBeforeExplicit = await iframeElements
    .nth(0)
    .evaluate((frame) => frame.style.height);
  const backgroundBeforeExplicit = await frameBackground(firstFrame);

  // An explicit choice — picked to differ from the CURRENT catalog theme —
  // applies to every frame immediately, independent of the catalog.
  const explicitTheme = catalogAfterFirstToggle === "dark" ? "light" : "dark";
  const explicitLabel = explicitTheme === "dark" ? "Dark" : "Light";
  await themeGroup.getByRole("button", { name: explicitLabel }).click();
  await expect(
    themeGroup.getByRole("button", { name: "Follow catalog" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => frameColorScheme(firstFrame)).toBe(explicitTheme);
  await expect.poll(() => frameColorScheme(secondFrame)).toBe(explicitTheme);
  // A real render change happened, not just a metadata flip.
  await expect
    .poll(() => frameBackground(firstFrame))
    .not.toBe(backgroundBeforeExplicit);

  // The postMessage-only sync must not disturb what the iframe already held.
  await expect(labelControl).toHaveValue("Theme state stays live");
  expect(await iframeElements.nth(0).evaluate((frame) => frame.style.height)).toBe(
    heightBeforeExplicit,
  );
  expect(
    await firstFrame.locator(":root").evaluate(
      (root) =>
        (root as HTMLElement & { __themeControlMarker__?: string })
          .__themeControlMarker__,
    ),
  ).toBe("preserved");

  // The explicit choice must hold even as the catalog changes underneath it —
  // this is the "held against catalog changes" contract the old per-frame Pin
  // control used to prove. Two more real toggles land the catalog back on
  // catalogAfterFirstToggle, which is NOT explicitTheme, so this is an
  // unambiguous check that the frames did not quietly resume following.
  await catalogToggle.click();
  await catalogToggle.click();
  const catalogThemeNow = await page.locator("html").getAttribute("data-theme");
  expect(catalogThemeNow).not.toBe(explicitTheme);
  await expect.poll(() => frameColorScheme(firstFrame)).toBe(explicitTheme);
  await expect.poll(() => frameColorScheme(secondFrame)).toBe(explicitTheme);

  // Navigate through the real client router. The new page mounts a FRESH
  // toolbar (Follow by default, per #541 — state is not carried across a page
  // swap) and its stage must receive the CURRENT catalog theme after
  // readiness, exactly as on first load.
  const catalogThemeAtNav = await page.locator("html").getAttribute("data-theme");
  await clickAndWaitForSwap(
    page,
    '#desktop-sidebar a[href="/components/input"]',
  );
  const navigatedIframe = page
    .locator('iframe[src*="/components/preview"]')
    .first();
  await expect(navigatedIframe).toBeAttached({ timeout: 15_000 });
  await navigatedIframe.scrollIntoViewIfNeeded();
  await expect(
    themeGroup.getByRole("button", { name: "Follow catalog" }),
  ).toHaveAttribute("aria-pressed", "true");
  const navigatedFrame = page
    .frameLocator('iframe[src*="/components/preview"]')
    .first();
  await expect
    .poll(() => frameColorScheme(navigatedFrame))
    .toBe(catalogThemeAtNav);
});
