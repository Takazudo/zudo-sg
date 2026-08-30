import { expect, test } from "@playwright/test";

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
