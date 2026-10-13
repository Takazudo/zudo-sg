import { expect, test, type Page } from "@playwright/test";

// zfb-runtime 4.4.0 restores a browser-created fragment entry on Back, and
// reports the following Forward as forward (zudo-front-builder #4157/#4165).

const PAGE_A = "/docs/architecture/engine-package";
const PAGE_B = "/docs/architecture/adopting";

type LifecycleEvent = { name: string; at: string; direction: string | null };

async function installProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as Window & { __lifecycle?: LifecycleEvent[] };
    target.__lifecycle = [];
    for (const name of ["before-swap", "after-swap", "page-load"]) {
      document.addEventListener(`zfb:${name}`, (event) => {
        const record = event as Event & { direction?: string };
        target.__lifecycle?.push({
          name,
          at: location.pathname + location.hash,
          direction: record.direction ?? null,
        });
      });
    }
  });
}

async function swapCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      ((window as Window & { __lifecycle?: LifecycleEvent[] }).__lifecycle ?? []).filter(
        (event) => event.name === "after-swap",
      ).length,
  );
}

async function readSwap(page: Page, index: number): Promise<LifecycleEvent | null> {
  return page.evaluate((swapIndex) => {
    const swaps = ((window as Window & { __lifecycle?: LifecycleEvent[] }).__lifecycle ?? []).filter(
      (event) => event.name === "after-swap",
    );
    return swaps[swapIndex] ?? null;
  }, index);
}

async function waitForNextSwap(page: Page, before: number, step: string): Promise<LifecycleEvent> {
  await page.waitForFunction(
    (expected) =>
      ((window as Window & { __lifecycle?: LifecycleEvent[] }).__lifecycle ?? []).filter(
        (event) => event.name === "after-swap",
      ).length > expected,
    before,
    { timeout: 15_000 },
  );
  const event = await readSwap(page, before);
  expect(event, `${step}: missing after-swap`).not.toBeNull();
  return event as LifecycleEvent;
}

async function expectArticle(page: Page, path: string, title: string, hash = ""): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}${hash}$`));
  await expect(page.locator("main h1")).toHaveText(title);
}

async function expectFragmentSettled(page: Page, id: string): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate((fragmentId) => {
        const element = document.getElementById(fragmentId);
        if (!element) return false;
        const top = element.getBoundingClientRect().top;
        const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const atEnd = window.scrollY >= maxScroll - 1;
        return top >= -2 && top < window.innerHeight && (atEnd || Math.abs(top - margin) <= 24);
      }, id),
    )
    .toBe(true);
}

test("Back restores a browser-created fragment and Forward returns to the next page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installProbe(page);

  const response = await page.goto(PAGE_A);
  expect(response?.status()).toBe(200);
  await page.locator("main h1").waitFor();
  await page.locator("[data-zfb-island][data-zfb-island-mounted]").first().waitFor();
  const titleA = (await page.locator("main h1").innerText()).trim();

  const fragmentId = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("main h2[id]")].find(
      (element) => element.getBoundingClientRect().top + window.scrollY > 300,
    );
    return heading?.id ?? null;
  });
  expect(fragmentId, "page A needs a heading below the first screen").toBeTruthy();

  const swapsBeforeFragment = await swapCount(page);
  await page.evaluate((id) => {
    location.hash = id;
  }, fragmentId);
  await expectArticle(page, PAGE_A, titleA, `#${fragmentId}`);
  await expectFragmentSettled(page, fragmentId!);
  expect(await swapCount(page), "a browser hash entry must not swap the page").toBe(swapsBeforeFragment);

  const swapsBeforeSoftNav = await swapCount(page);
  await page.evaluate((href) => {
    const link = document.querySelector<HTMLAnchorElement>(`#desktop-sidebar a[href="${href}"]`);
    if (!link) throw new Error(`Missing sidebar link ${href}`);
    link.click();
  }, PAGE_B);
  const toB = await waitForNextSwap(page, swapsBeforeSoftNav, "soft navigation to B");
  const titleB = (await page.locator("main h1").innerText()).trim();
  expect(titleB).not.toBe(titleA);
  await expectArticle(page, PAGE_B, titleB);
  expect(toB.direction).toBe("forward");

  const swapsBeforeBack = await swapCount(page);
  await page.goBack();
  const back = await waitForNextSwap(page, swapsBeforeBack, "Back to A#fragment");
  await expectArticle(page, PAGE_A, titleA, `#${fragmentId}`);
  await expect(page.locator(`#${fragmentId}`)).toHaveCount(1);
  await expectFragmentSettled(page, fragmentId!);
  expect(back.direction).toBe("back");

  const swapsBeforeForward = await swapCount(page);
  await page.goForward();
  const forward = await waitForNextSwap(page, swapsBeforeForward, "Forward to B");
  await expectArticle(page, PAGE_B, titleB);
  await expect(page.locator("main h1")).not.toHaveText(titleA);
  expect(forward.direction).toBe("forward");
});
