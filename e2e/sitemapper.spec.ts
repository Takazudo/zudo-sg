import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  captureUnexpectedBrowserErrors,
  openComposerLibrary,
  resetComposerPersistence,
} from "./support/composer-persistence";

const SITEMAPPER_DATABASE_NAME = "zudo-sg-sitemapper";
const THEME_KEY = "zudo-doc-theme";
const SITEMAP_NAME = "E2E sitemap";
const COMPOSITION_NAME = "Sitemapper composition";
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
] as const;

type Theme = (typeof THEMES)[number];

const canvas = (page: Page): Locator => page.locator("section.sg-sitemapper-canvas");
const nodes = (page: Page): Locator => canvas(page).locator(".sg-sitemapper-node");
const node = (page: Page, title: string): Locator => nodes(page).filter({ hasText: title }).filter({
  has: page.locator(".sg-sitemapper-node__title", { hasText: title }),
}).first();

async function deleteDatabase(page: Page, name: string): Promise<void> {
  await page.evaluate(async (databaseName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error(`Could not delete ${databaseName}`));
      request.onblocked = () => reject(new Error(`Deleting ${databaseName} was blocked`));
    });
  }, name);
}

async function resetPersistence(page: Page): Promise<void> {
  // The preview route mounts neither authoring provider, so no live database
  // connection can block deletion between independently repeatable cases.
  await resetComposerPersistence(page);
  await deleteDatabase(page, SITEMAPPER_DATABASE_NAME);
  await page.evaluate((key) => localStorage.removeItem(key), THEME_KEY);
}

async function waitForSitemapperLibrary(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Sitemaps" })).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: "New sitemap" })
      .or(page.getByText("Loading Sitemaps…"))
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New sitemap" })).toBeEnabled({ timeout: 15_000 });
}

async function createSitemap(page: Page, name = SITEMAP_NAME): Promise<void> {
  page.once("dialog", async (dialog) => dialog.accept(name));
  await page.getByRole("button", { name: "New sitemap" }).click();
  await expect(page.locator(".sg-sitemapper-shell")).toBeVisible();
  await expect(page.locator(".sg-sitemapper-save-status")).toHaveAttribute("data-sg-status", "saved");
}

async function openSitemap(page: Page, name = SITEMAP_NAME): Promise<void> {
  await waitForSitemapperLibrary(page);
  await page.getByRole("button", { name: new RegExp(`^${name} ·`) }).click();
  await expect(page.locator(".sg-sitemapper-shell")).toBeVisible();
}

async function selectNode(page: Page, title: string): Promise<void> {
  await node(page, title).click();
  await expect(node(page, title)).toHaveAttribute("data-sg-selected", "true");
}

async function canvasAction(page: Page, title: string, action: string): Promise<void> {
  await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
  const menu = page.getByRole("menu", { name: `Actions for ${title}` });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: action, exact: true }).click();
}

async function renameSelected(page: Page, title: string): Promise<void> {
  const inspector = page.locator("#sg-sitemapper-inspector");
  const input = inspector.getByLabel("Title", { exact: true });
  await input.fill(title);
  await input.press("Tab");
  await expect(node(page, title)).toBeVisible();
}

async function updateSelectedField(page: Page, label: string, value: string): Promise<void> {
  const input = page.locator("#sg-sitemapper-inspector").getByLabel(label, { exact: true });
  await input.fill(value);
  await input.press("Tab");
}

async function waitForSaved(page: Page): Promise<void> {
  await expect(page.locator(".sg-sitemapper-save-status")).toHaveAttribute(
    "data-sg-status",
    "saved",
    { timeout: 15_000 },
  );
}

async function createComposition(page: Page): Promise<string> {
  await openComposerLibrary(page);
  await expect(
    page.locator(".sg-composer-library-open")
      .or(page.getByRole("heading", { name: "No compositions yet" }))
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "New composition" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New composition" });
  await dialog.getByLabel("Name", { exact: true }).fill(COMPOSITION_NAME);
  await dialog.getByRole("button", { name: "Create composition", exact: true }).click();
  await expect(page).toHaveURL(/#\/composition\/indexeddb\/[^/]+$/);
  await expect(page.locator(".sg-composer-save-status")).toHaveAttribute("data-sg-status", "saved");
  return decodeURIComponent(page.url().split("/").at(-1) ?? "");
}

async function buildVisualTree(page: Page): Promise<void> {
  await canvasAction(page, "Home", "Add child");
  await renameSelected(page, "Primary");
  await canvasAction(page, "Primary", "Add sibling");
  await renameSelected(page, "Secondary");
  await updateSelectedField(page, "Slug", "https://example.com/secondary");
  await selectNode(page, "Primary");
  await canvasAction(page, "Primary", "Add child");
  await renameSelected(page, "Detail");
  await waitForSaved(page);
}

async function setThemeAndReopen(page: Page, theme: Theme): Promise<void> {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: THEME_KEY,
    value: theme,
  });
  await page.reload();
  await openSitemap(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toContain(theme);
}

async function assertNoBodyOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.root, "documentElement must not scroll horizontally")
    .toBeLessThanOrEqual(widths.viewport);
  expect(widths.body, "body must not scroll horizontally")
    .toBeLessThanOrEqual(widths.viewport);
}

async function assertDesktopTreeRailUsable(page: Page): Promise<void> {
  const rail = page.locator(".sg-sitemapper-tree-rail");
  await expect(rail).toBeVisible();
  const geometry = await rail.evaluate((element) => {
    const railBox = element.getBoundingClientRect();
    const row = element.querySelector<HTMLElement>('[data-sg-tree-root="true"] > .sg-sitemapper-tree-row');
    const title = row?.querySelector<HTMLElement>(".sg-sitemapper-tree-select-title");
    if (!row || !title) throw new Error("Missing rendered root tree row");
    const titleBox = title.getBoundingClientRect();
    const titleStyle = getComputedStyle(title);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      titleWidth: titleBox.width,
      titleDisplay: titleStyle.display,
      titleVisibility: titleStyle.visibility,
      controls: [...row.querySelectorAll<HTMLElement>("button")].map((control) => {
        const box = control.getBoundingClientRect();
        return {
          name: control.getAttribute("aria-label") ?? control.textContent?.trim() ?? "unnamed",
          left: box.left,
          right: box.right,
          width: box.width,
          railLeft: railBox.left,
          railRight: railBox.right,
        };
      }),
    };
  });
  expect(geometry.scrollWidth, "the outline rail must not overflow horizontally")
    .toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.titleDisplay).not.toBe("none");
  expect(geometry.titleVisibility).not.toBe("hidden");
  expect(geometry.titleWidth, "the root title must retain readable inline space").toBeGreaterThanOrEqual(32);
  expect(geometry.controls.length, "all root row controls must remain rendered").toBeGreaterThanOrEqual(9);
  for (const control of geometry.controls) {
    expect(control.width, `${control.name} must remain visibly rendered`).toBeGreaterThan(0);
    expect(control.left, `${control.name} must start inside the outline rail`).toBeGreaterThanOrEqual(control.railLeft);
    expect(control.right, `${control.name} must end inside the outline rail`).toBeLessThanOrEqual(control.railRight);
  }
}

async function assertOrthogonalConnectors(page: Page): Promise<void> {
  const paths = canvas(page).locator("svg.sg-sitemapper-connectors path");
  expect(await paths.count(), "the non-trivial tree must render connectors").toBeGreaterThan(0);
  for (const path of await paths.all()) {
    const grammar = await path.getAttribute("d");
    expect(grammar, "each connector must contain only one M followed by H/V segments").toMatch(
      /^M -?\d+(?:\.5)? -?\d+(?:\.5)?(?: [HV] -?\d+(?:\.5)?)+$/,
    );
    expect(grammar, "diagonal and bezier SVG commands are forbidden").not.toMatch(/[LQCSTA]/i);
  }
  await expect(canvas(page).locator('path.sg-sitemapper-connector[data-sg-external="true"]').first())
    .toHaveCSS("stroke-dasharray", /\d/);
}

async function assertNoConnectorCrossesNode(page: Page): Promise<void> {
  const crossings = await canvas(page).evaluate((surface) => {
    const stage = surface.querySelector<HTMLElement>(".sg-sitemapper-canvas__stage");
    if (!stage) return ["missing stage"];
    const stageBox = stage.getBoundingClientRect();
    const boxes = [...stage.querySelectorAll<HTMLElement>(".sg-sitemapper-node")].map((element) => {
      const box = element.getBoundingClientRect();
      return {
        title: element.querySelector(".sg-sitemapper-node__title")?.textContent ?? "unnamed node",
        left: box.left - stageBox.left,
        right: box.right - stageBox.left,
        top: box.top - stageBox.top,
        bottom: box.bottom - stageBox.top,
      };
    });
    const failures: string[] = [];
    for (const path of stage.querySelectorAll<SVGPathElement>("path.sg-sitemapper-connector")) {
      const tokens = (path.getAttribute("d") ?? "").match(/[MHV]|-?\d+(?:\.\d+)?/g) ?? [];
      let cursor = 0;
      let x = 0;
      let y = 0;
      while (cursor < tokens.length) {
        const command = tokens[cursor++];
        if (command === "M") {
          x = Number(tokens[cursor++]);
          y = Number(tokens[cursor++]);
          continue;
        }
        const next = Number(tokens[cursor++]);
        const x2 = command === "H" ? next : x;
        const y2 = command === "V" ? next : y;
        for (const box of boxes) {
          const crossesVertical = x === x2
            && x > box.left + 1 && x < box.right - 1
            && Math.max(Math.min(y, y2), box.top + 1) < Math.min(Math.max(y, y2), box.bottom - 1);
          const crossesHorizontal = y === y2
            && y > box.top + 1 && y < box.bottom - 1
            && Math.max(Math.min(x, x2), box.left + 1) < Math.min(Math.max(x, x2), box.right - 1);
          if (crossesVertical || crossesHorizontal) failures.push(`${path.getAttribute("d")} crosses ${box.title}`);
        }
        x = x2;
        y = y2;
      }
    }
    return failures;
  });
  expect(crossings, "connectors must not cross the interior of related or unrelated boxes").toEqual([]);
}

async function assertTierAndSelectionStyles(page: Page): Promise<void> {
  await selectNode(page, "Detail");
  const styles = await canvas(page).evaluate((surface) => {
    const read = (depth: string) => {
      const element = surface.querySelector<HTMLElement>(`.sg-sitemapper-node[data-sg-depth="${depth}"]`);
      if (!element) throw new Error(`Missing depth ${depth}`);
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        background: style.backgroundColor,
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        color: style.color,
        fontWeight: style.fontWeight,
        radius: style.borderTopLeftRadius,
        width: box.width,
        height: box.height,
      };
    };
    const selected = surface.querySelector<HTMLElement>('[data-sg-selected="true"]');
    const badge = selected?.querySelector<HTMLElement>(".sg-sitemapper-node__selected");
    if (!selected || !badge) throw new Error("Missing selected node affordance");
    const selectedStyle = getComputedStyle(selected);
    const badgeBox = badge.getBoundingClientRect();
    return {
      root: read("0"),
      depth1: read("1"),
      depth2: read("2"),
      selected: {
        outlineStyle: selectedStyle.outlineStyle,
        outlineWidth: selectedStyle.outlineWidth,
        badgeWidth: badgeBox.width,
        badgeHeight: badgeBox.height,
        accessibleText: badge.textContent,
      },
    };
  });

  for (const tier of [styles.root, styles.depth1, styles.depth2]) {
    expect(tier.width, "every tier must render as a box").toBeGreaterThan(0);
    expect(tier.height, "every tier must render as a box").toBeGreaterThan(0);
    expect(parseFloat(tier.radius), "every node box must be rectangular with the specified radius")
      .toBeGreaterThan(0);
    expect(tier.background, "tier surfaces must resolve to an actual theme color").not.toBe("rgba(0, 0, 0, 0)");
  }
  expect(styles.root.background, "root must use its own accent fill").not.toBe(styles.depth1.background);
  expect(styles.depth1.background, "depth 1 must use surface-2 rather than the depth-2 surface")
    .not.toBe(styles.depth2.background);
  expect(parseFloat(styles.depth1.borderWidth), "depth 1 uses the required strong 2px border").toBe(2);
  expect(parseFloat(styles.depth2.borderWidth), "depth 2 uses the required normal 1px border").toBe(1);
  expect(Number(styles.root.fontWeight), "root title weight").toBeGreaterThanOrEqual(700);
  expect(Number(styles.depth1.fontWeight), "depth-1 title weight").toBeGreaterThanOrEqual(600);
  expect(Number(styles.depth2.fontWeight), "depth-2 title must remain normal weight").toBeLessThan(600);
  expect(styles.selected.outlineStyle, "selection must have a persistent non-color outline").toBe("solid");
  expect(parseFloat(styles.selected.outlineWidth)).toBeGreaterThanOrEqual(3);
  expect(styles.selected.badgeWidth).toBeGreaterThanOrEqual(24);
  expect(styles.selected.badgeHeight).toBeGreaterThanOrEqual(24);
  expect(styles.selected.accessibleText).toContain("Selected");
  const external = canvas(page).locator('.sg-sitemapper-node[data-sg-external="true"]').first();
  await expect(external, "the external branch must use the outlined dashed treatment").toHaveCSS(
    "border-top-style",
    "dashed",
  );
}

async function assertLeavesHaveNoOutboundSpine(page: Page): Promise<void> {
  const outbound = await canvas(page).evaluate((surface) => {
    const stage = surface.querySelector<HTMLElement>(".sg-sitemapper-canvas__stage")!;
    const stageBox = stage.getBoundingClientRect();
    const leaf = [...stage.querySelectorAll<HTMLElement>(".sg-sitemapper-node")]
      .find((element) => element.querySelector(".sg-sitemapper-node__title")?.textContent === "Detail");
    if (!leaf) throw new Error("Missing Detail leaf");
    const box = leaf.getBoundingClientRect();
    const expectedX = box.left - stageBox.left + 24;
    const expectedY = box.bottom - stageBox.top;
    return [...stage.querySelectorAll<SVGPathElement>("path.sg-sitemapper-connector")]
      .map((path) => path.getAttribute("d") ?? "")
      .filter((path) => {
        const match = /^M (-?\d+(?:\.5)?) (-?\d+(?:\.5)?)/.exec(path);
        return match && Math.abs(Number(match[1]) - expectedX) <= 1 && Math.abs(Number(match[2]) - expectedY) <= 1;
      });
  });
  expect(outbound, "a leaf node must not originate a connector spine").toEqual([]);
}

async function assertNarrowEditingIsOperable(page: Page): Promise<void> {
  await expect(page.locator(".sg-sitemapper-tree-rail")).not.toBeVisible();
  await expect(page.locator("#sg-sitemapper-inspector")).not.toBeVisible();
  await selectNode(page, "Detail");

  const actionTriggers = canvas(page).locator(".sg-sitemapper-node__menu-trigger");
  await expect(actionTriggers).toHaveCount(await nodes(page).count());
  for (const actionTrigger of await actionTriggers.all()) {
    await expect(actionTrigger).toBeVisible();
    const box = await actionTrigger.boundingBox();
    expect(box?.width, "every node action trigger must retain its 44px touch width")
      .toBeGreaterThanOrEqual(44);
    expect(box?.height, "every node action trigger must retain its 44px touch height")
      .toBeGreaterThanOrEqual(44);
  }
  const trigger = page.getByRole("button", { name: "Actions for Detail", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Actions for Detail" });
  await expect(menu).toBeVisible();
  for (const action of ["Add child", "Add sibling", "Duplicate", "Delete"] as const) {
    await expect(menu.getByRole("menuitem", { name: action, exact: true })).toBeEnabled();
  }
  await trigger.click();

  const baseline = await nodes(page).count();
  const tray = canvas(page).locator(".sg-sitemapper-canvas__action-tray");
  await expect(tray).toBeVisible();
  await expect(tray).toHaveAttribute("aria-label", "Actions for Detail");
  for (const action of ["Add child", "Add sibling", "Duplicate", "Delete"] as const) {
    await expect(tray.getByRole("button", { name: action, exact: true })).toBeEnabled();
  }

  await tray.getByRole("button", { name: "Add child", exact: true }).click();
  await expect(nodes(page)).toHaveCount(baseline + 1);
  await tray.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(nodes(page)).toHaveCount(baseline);

  await selectNode(page, "Detail");
  await tray.getByRole("button", { name: "Add sibling", exact: true }).click();
  await expect(nodes(page)).toHaveCount(baseline + 1);
  await tray.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(nodes(page)).toHaveCount(baseline);

  await selectNode(page, "Detail");
  await tray.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(nodes(page)).toHaveCount(baseline + 1);
  // Duplicate preserves page properties and title; the controlled selection
  // moves to the cloned node, so the single sticky tray now targets the copy.
  await expect(tray).toHaveAttribute("aria-label", "Actions for Detail");
  await tray.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(nodes(page)).toHaveCount(baseline);
  await waitForSaved(page);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, width: number, theme: Theme): Promise<void> {
  const name = `sitemapper-${width}-${theme}`;
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(name, {
    path,
    contentType: "image/png",
  });
}

test.describe("Sitemapper browser exit gate", () => {
  test.beforeEach(async ({ page }) => {
    await resetPersistence(page);
  });

  test.afterEach(async ({ page }) => {
    await resetPersistence(page);
  });

  test("completes CRUD, composition-reference persistence, and broken-reference recovery", async ({ page }) => {
    const errors = captureUnexpectedBrowserErrors(page);
    const compositionId = await createComposition(page);

    await page.goto("/");
    await page.locator("header[data-header] nav[data-header-nav]")
      .getByRole("link", { name: "Sitemapper", exact: true }).click();
    await expect(page).toHaveURL(/\/sitemapper\/?$/);
    await waitForSitemapperLibrary(page);
    await createSitemap(page);

    await canvasAction(page, "Home", "Add child");
    await renameSelected(page, "Branch A");
    await canvasAction(page, "Branch A", "Add sibling");
    await renameSelected(page, "Branch B");

    await page.getByRole("button", { name: "Expand Home" }).click();
    const branchARow = page.locator(".sg-sitemapper-tree-select-title", { hasText: "Branch A" })
      .locator("xpath=ancestor::li[1]");
    await branchARow.getByRole("button", { name: "Move down", exact: true }).click();
    const childTitles = page.locator(".sg-sitemapper-tree-list-nested > .sg-sitemapper-tree-node > .sg-sitemapper-tree-row .sg-sitemapper-tree-select-title");
    await expect(childTitles).toHaveText(["Branch B", "Branch A"]);

    await selectNode(page, "Branch A");
    await canvasAction(page, "Branch A", "Add child");
    await renameSelected(page, "Assigned page");
    await canvasAction(page, "Branch A", "Duplicate");
    await expect(nodes(page).filter({ hasText: "Assigned page" })).toHaveCount(2);
    await canvasAction(page, "Branch B", "Delete");
    await expect(node(page, "Branch B")).toHaveCount(0);

    await selectNode(page, "Assigned page");
    await page.getByRole("button", { name: "Choose composition" }).click();
    const picker = page.getByRole("dialog", { name: "Choose a composition" });
    const compositionRow = picker.getByRole("listitem").filter({ hasText: COMPOSITION_NAME });
    await compositionRow.getByRole("button", { name: new RegExp(`Assign ${COMPOSITION_NAME}`) }).click();
    await expect(page.getByText(COMPOSITION_NAME, { exact: true })).toBeVisible();
    await waitForSaved(page);

    await page.reload();
    await openSitemap(page);
    await expect(nodes(page).filter({ hasText: "Branch A" })).toHaveCount(2);
    await expect(nodes(page).filter({ hasText: "Assigned page" })).toHaveCount(2);
    await expect(node(page, "Branch B")).toHaveCount(0);
    await selectNode(page, "Assigned page");
    await expect(page.getByText(COMPOSITION_NAME, { exact: true })).toBeVisible();
    await expect(page.getByText("Browser storage", { exact: true })).toBeVisible();

    await page.locator("header[data-header] nav[data-header-nav]")
      .getByRole("link", { name: "Composer", exact: true }).click();
    await openComposerLibrary(page);
    await page.getByRole("button", { name: `Delete ${COMPOSITION_NAME}`, exact: true }).click();
    const confirmation = page.getByRole("group", { name: `Confirm deleting ${COMPOSITION_NAME}` });
    await confirmation.getByRole("button", { name: "Delete composition", exact: true }).click();
    await expect(page.getByRole("button", { name: `Open ${COMPOSITION_NAME}` })).toHaveCount(0);

    await page.locator("header[data-header] nav[data-header-nav]")
      .getByRole("link", { name: "Sitemapper", exact: true }).click();
    await openSitemap(page);
    await selectNode(page, "Assigned page");
    await expect(page.getByText("Broken reference", { exact: true })).toBeVisible();
    await expect(page.getByText("Raw reference", { exact: true })).toBeVisible();
    await expect(page.getByText(`indexeddb:${compositionId}`, { exact: true })).toBeVisible();
    await expect(page.locator(".sg-sitemapper-shell")).toBeVisible();
    expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
  });

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${viewport.width}px ${theme}: rendered visual and editing contract`, async ({ page }, testInfo) => {
        const errors = captureUnexpectedBrowserErrors(page);
        // Author through the legitimately visible desktop inspector first;
        // only then enter the target visual viewport. Narrow interaction
        // assertions remain canvas/tray-only below.
        await page.setViewportSize(VIEWPORTS[0]);
        await page.goto("/sitemapper/");
        await waitForSitemapperLibrary(page);
        await createSitemap(page);
        await buildVisualTree(page);
        await page.setViewportSize(viewport);
        await setThemeAndReopen(page, theme);

        try {
          await expect(canvas(page).locator(".sg-sitemapper-canvas__stage")).toHaveAttribute(
            "data-sg-layout",
            viewport.width < 1024 ? "outline" : "cluster",
          );
          await assertNoBodyOverflow(page);
          await assertOrthogonalConnectors(page);
          await assertNoConnectorCrossesNode(page);
          await assertLeavesHaveNoOutboundSpine(page);
          await assertTierAndSelectionStyles(page);
          if (viewport.width === 375) await assertNarrowEditingIsOperable(page);
          else await assertDesktopTreeRailUsable(page);
          expect(errors).toEqual({ pageErrors: [], consoleErrors: [] });
        } finally {
          // Keep a rendered artifact even when a direct contract assertion
          // fails so the centralized visual review can diagnose the state.
          await attachScreenshot(page, testInfo, viewport.width, theme);
        }
      });
    }
  }
});
