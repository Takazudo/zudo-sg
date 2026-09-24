import { expect, test, type Locator, type Page } from "@playwright/test";
import { setAppearanceTheme } from "./helpers/appearance";

// Browser acceptance guard for the --sg-* chrome token namespace (#797/#806):
// the engine chrome must render correctly in the browser on the root host,
// in both color schemes. The compile-level order-proofing itself (both
// import orders, both consumer-first and engine-first) is covered by
// packages/styleguide/src/__tests__/chrome-token-reset.test.ts; this spec is
// the runtime confirm that the migrated chrome actually paints as intended
// on a real page, not just that the CSS compiles with non-empty values.

function isTransparent(color: string): boolean {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return color === "transparent";
  const parts = match[1].split(",").map((s) => s.trim());
  return parts.length === 4 && Number(parts[3]) === 0;
}

async function setScheme(page: Page, scheme: "light" | "dark"): Promise<void> {
  await page.goto("/components");
  await setAppearanceTheme(page, scheme);
}

async function backgroundColor(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

for (const scheme of ["light", "dark"] as const) {
  test(`chrome renders the --sg-* token namespace correctly in ${scheme} scheme`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1990, height: 1200 });
    await setScheme(page, scheme);

    const card = page.locator("[data-sg-card]").first();
    await expect(card).toBeAttached();
    const href = await card.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);

    // #sg-code-panel: 1px non-transparent left border.
    const codePanel = page.locator("#sg-code-panel").first();
    await expect(codePanel).toBeAttached();
    const border = await codePanel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.borderLeftWidth, color: cs.borderLeftColor, style: cs.borderLeftStyle };
    });
    expect(border.width).toBe("1px");
    expect(border.style).not.toBe("none");
    expect(isTransparent(border.color)).toBe(false);

    // Workbench toolbar and the code-panel toggle control have a filled
    // (non-transparent) surface background.
    const toolbar = page.locator(".sg-workbench-toolbar").first();
    await expect(toolbar).toBeVisible();
    expect(isTransparent(await backgroundColor(toolbar))).toBe(false);

    const codePanelToggle = page.locator('button[title="Toggle code panel"]').first();
    await expect(codePanelToggle).toBeVisible();
    expect(isTransparent(await backgroundColor(codePanelToggle))).toBe(false);

    // The tile-size segmented control (on /components) reads as one group.
    await page.goto("/components");
    await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    const tileGroup = page.getByRole("group", { name: "Tile size" }).first();
    await expect(tileGroup).toBeVisible();
    const tileGroupStyle = await tileGroup.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { border: cs.borderWidth, borderColor: cs.borderColor, bg: cs.backgroundColor };
    });
    expect(tileGroupStyle.border).not.toBe("0px");
    expect(isTransparent(tileGroupStyle.borderColor)).toBe(false);
    expect(isTransparent(tileGroupStyle.bg)).toBe(false);

    // --sg-border / --sg-surface-2 computed values are non-empty on the root.
    const rootVars = await page.locator("html").evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        border: cs.getPropertyValue("--sg-border").trim(),
        surface2: cs.getPropertyValue("--sg-surface-2").trim(),
      };
    });
    expect(rootVars.border.length).toBeGreaterThan(0);
    expect(rootVars.surface2.length).toBeGreaterThan(0);

    // The unknown-preview message inside the preview iframe has a
    // non-transparent computed color.
    await page.goto("/components/preview?slug=__nonexistent__&variant=__nonexistent__");
    const unknownMessage = page.locator("text=Unknown preview:").first();
    await expect(unknownMessage).toBeVisible();
    expect(isTransparent(await unknownMessage.evaluate((el) => getComputedStyle(el).color))).toBe(
      false,
    );

    // The preview canvas background still follows the host's --color-bg.
    const bodyBg = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
    const colorBgVar = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--color-bg)";
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    });
    expect(bodyBg).toBe(colorBgVar);
  });
}
