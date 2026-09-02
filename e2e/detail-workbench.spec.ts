import { expect, test, type Page } from "@playwright/test";

// Contracts for the component-detail workbench (#541): ONE page-level toolbar
// owning theme / viewport / layout / code-panel / preview-tokens, and one
// controlled stage per variant.
//
// `typography` is the fixture throughout because it ships six variants — the
// case the old per-stage controls turned into 42 buttons, and enough vertical
// run at 1440x900 that the last stage is genuinely below the fold.

const STORY = "/components/typography";
const STAGE = "Preview viewport canvas";

/** Click a link in the desktop sidebar and wait for the client-router swap. */
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

async function openStory(page: Page, path = STORY): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.locator(".sg-workbench-toolbar")).toBeVisible({
    timeout: 15_000,
  });
}

test("the global controls appear exactly once, however many variants there are", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page);

  const stages = page.getByRole("region", { name: STAGE });
  expect(await stages.count()).toBeGreaterThan(3);

  await expect(page.getByRole("group", { name: "Preview theme" })).toHaveCount(1);
  await expect(page.getByRole("group", { name: "Preview viewport" })).toHaveCount(1);
  await expect(page.getByRole("group", { name: "Preview layout" })).toHaveCount(1);

  // The panel itself stays in the SSR output and in the TOC slot.
  await expect(page.locator("#sg-code-panel")).toBeAttached();

  // The header overlay that used to carry these controls is gone for good.
  await expect(page.locator(".sg-header-toggles, .sg-header-region")).toHaveCount(0);
});

test("a stage scrolled in AFTER the toolbar moved adopts the current values", async ({
  page,
}) => {
  // The regression the single-island design exists to prevent. Stages hydrate
  // lazily, so a toolbar that broadcast its state would fire that event before
  // the below-the-fold stages existed; each would silently keep the default.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page);

  const viewportGroup = page.getByRole("group", { name: "Preview viewport" });
  const themeGroup = page.getByRole("group", { name: "Preview theme" });
  await viewportGroup.getByRole("button", { name: "Tablet" }).click();
  await themeGroup.getByRole("button", { name: "Dark" }).click();

  const stages = page.getByRole("region", { name: STAGE });
  const lastIndex = (await stages.count()) - 1;
  const last = stages.nth(lastIndex);

  // It was never on screen while either control was used.
  await last.scrollIntoViewIfNeeded();

  await expect
    .poll(() => last.evaluate((el) => (el.firstElementChild as HTMLElement).style.width))
    .toBe("768px");
  await expect
    .poll(
      () =>
        page
          .frameLocator('iframe[src*="/components/preview"]')
          .nth(lastIndex)
          .locator(":root")
          .evaluate((root) => getComputedStyle(root).colorScheme),
      { timeout: 15_000 },
    )
    .toBe("dark");
});

test("one toolbar viewport click retargets every stage, desktop stays an honest 1280", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page);

  const stages = page.getByRole("region", { name: STAGE });
  const count = await stages.count();
  await page
    .getByRole("group", { name: "Preview viewport" })
    .getByRole("button", { name: "Desktop" })
    .click();

  await expect
    .poll(() =>
      stages.evaluateAll((els) =>
        els.map((el) => (el.firstElementChild as HTMLElement).style.width),
      ),
    )
    .toEqual(new Array(count).fill("1280px"));

  // The preset is a real layout viewport, not a scaled-down mock — checked on
  // the first stage and on one that was below the fold when the click landed.
  for (const index of [0, count - 1]) {
    await stages.nth(index).scrollIntoViewIfNeeded();
    await expect
      .poll(
        () =>
          page
            .frameLocator('iframe[src*="/components/preview"]')
            .nth(index)
            .locator(":root")
            .evaluate(() => innerWidth),
        { timeout: 15_000 },
      )
      .toBe(1280);
  }

  // The overflow the preset creates stays keyboard reachable.
  const first = stages.first();
  await expect(first).toHaveAttribute("tabindex", "0");
  const geometry = await first.evaluate((element) => {
    element.scrollLeft = 0;
    const left = element.getBoundingClientRect().left;
    element.scrollLeft = element.scrollWidth;
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      maxScrollLeft: element.scrollLeft,
      containerLeft: left,
    };
  });
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  expect(geometry.maxScrollLeft).toBeGreaterThan(0);
});

test("the preview column gets the room the route exists to provide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page);

  // `main.clientWidth` is the content column as the width policy computes it:
  // band - code panel - band gap. The band is bounded by the sidebar at 1152
  // regardless of `contentWide`, so the panel width is the real lever.
  const read = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('[aria-label="Preview viewport canvas"]')!;
      const panel = document.querySelector("#sg-code-panel")!;
      return {
        contentColumn: (document.querySelector("main") as HTMLElement).clientWidth,
        panelShown: getComputedStyle(panel).display !== "none",
        // The stage's own drawable area — the number the issue quoted as 443.
        previewArea: Math.round(
          (canvas.firstElementChild as HTMLElement).getBoundingClientRect().width,
        ),
      };
    });

  const open = await read();
  expect(open.panelShown).toBe(true);
  expect(open.contentColumn).toBeGreaterThanOrEqual(700);
  // Measured 644 against a pre-change 443. Floored well below the measurement
  // so the assertion tracks the regression, not the exact chrome arithmetic.
  expect(open.previewArea).toBeGreaterThanOrEqual(600);

  await page.getByRole("button", { name: /Code panel/ }).click();
  await expect
    .poll(async () => (await read()).panelShown)
    .toBe(false);

  const collapsed = await read();
  expect(collapsed.contentColumn).toBeGreaterThanOrEqual(1050);
});

test("the code-panel toggle is never hidden by the state it sets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page);

  const toggle = page.getByRole("button", { name: /Code panel/ });
  const panel = page.locator("#sg-code-panel");
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(panel).toBeHidden();
  // The control that un-hides the panel must not live inside it.
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  // Persisted hidden state is restored before first paint — the toggle must
  // survive that too, or the panel is gone for good.
  await page.reload();
  await expect(page.locator(".sg-workbench-toolbar")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("#sg-code-panel")).toBeAttached();
  await expect(page.locator("#sg-code-panel")).toBeHidden();
  const restoredToggle = page.getByRole("button", { name: /Code panel/ });
  await expect(restoredToggle).toBeVisible();

  await restoredToggle.click();
  await expect(page.locator("#sg-code-panel")).toBeVisible();
});

test("the code-panel resizer still works after a detail -> detail SPA navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page, "/components/cta-button");

  await clickAndWaitForSwap(page, '#desktop-sidebar a[href="/components/input"]');
  await expect(page.locator(".sg-workbench-toolbar")).toBeVisible({
    timeout: 15_000,
  });

  const handle = page.locator("[data-sg-code-panel-resizer]");
  await expect(handle).toBeAttached();
  const panelWidth = () =>
    page.evaluate(() =>
      Math.round(
        document.querySelector("#sg-code-panel")!.getBoundingClientRect().width,
      ),
    );

  const before = await panelWidth();
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(panelWidth).toBeLessThan(before);
});

test("the content column shows the source once and never overflows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page);

  // The duplicate USAGE block held the same string as the code panel's Source
  // view and was the copy overflowing its own box.
  await expect(page.locator("main .sg-snippet")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Usage" })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll("main pre")]
        .filter((pre) => pre.scrollWidth > pre.clientWidth + 1)
        .map((pre) => ({ client: pre.clientWidth, scroll: pre.scrollWidth })),
    ),
  ).toEqual([]);
});

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`no horizontal page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStory(page);

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}
