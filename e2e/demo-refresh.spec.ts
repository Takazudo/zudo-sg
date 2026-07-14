import { expect, test, type Page } from "@playwright/test";

const THEME_STORAGE_KEY = "zudo-sg-demo-theme";
const JAPANESE_SCRIPT = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

const IMAGE_CASES = [
  { path: "/company/message/", category: "corporate", fallback: true },
  { path: "/lines/vacuum/products/", category: "vacuum" },
  { path: "/lines/process/products/", category: "process" },
  { path: "/lines/laser/products/", category: "laser" },
  { path: "/lines/meeting/products/", category: "meeting" },
  { path: "/lines/beauty/products/", category: "beauty" },
  { path: "/sustainability/", category: "sustainability" },
] as const;

type Theme = "light" | "dark";

async function setStoredThemeAndReload(page: Page, theme: Theme): Promise<void> {
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: THEME_STORAGE_KEY, value: theme },
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function expectOnlyBreakpointThemeControl(page: Page, breakpoint: "desktop" | "mobile", theme: Theme) {
  const desktop = page.locator('[data-theme-control="desktop"] button');
  const mobile = page.locator('[data-theme-control="mobile"] button');
  const visible = page.locator("[data-theme-control] button:visible");

  await expect(visible).toHaveCount(1);
  await expect(breakpoint === "desktop" ? desktop : mobile).toBeVisible();
  await expect(breakpoint === "desktop" ? mobile : desktop).toBeHidden();
  await expect(visible).toHaveAttribute("aria-pressed", String(theme === "dark"));
  await expect(visible).toHaveAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
}

test("light SSR baseline restores saved themes and persists a visible control change", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await setStoredThemeAndReload(page, "dark");
  await expectOnlyBreakpointThemeControl(page, "desktop", "dark");

  const control = page.locator('[data-theme-control="desktop"] button');
  await control.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY))
    .toBe("light");
});

test("forced light and dark roots expose exactly one control at each responsive breakpoint", async ({ page }) => {
  const breakpoints = [
    { name: "desktop", width: 1280, height: 900, visibleControl: "desktop" },
    { name: "mobile", width: 390, height: 844, visibleControl: "mobile" },
  ] as const;

  for (const breakpoint of breakpoints) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto("/");

    for (const theme of ["light", "dark"] as const) {
      await setStoredThemeAndReload(page, theme);
      await expectOnlyBreakpointThemeControl(page, breakpoint.visibleControl, theme);
    }
  }
});

test("desktop Browse is a bounded real site-tree walk with pointer and keyboard semantics", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "Browse site sections" });
  const panel = page.locator("[data-ctx-panel]");

  await trigger.hover();
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const browseTree = await page.evaluate(() => {
    const panelElement = document.querySelector<HTMLElement>("[data-ctx-panel]");
    const drawer = document.getElementById("zui-nav-drawer");
    if (!panelElement || !drawer) return null;

    const pathFrom = (href: string): string => new URL(href, location.origin).pathname.replace(/\/+$/, "") || "/";
    const panelPaths = Array.from(panelElement.querySelectorAll<HTMLAnchorElement>("a[href]"), (link) =>
      pathFrom(link.href),
    );
    const railPaths = Array.from(drawer.querySelectorAll<HTMLAnchorElement>('[role="group"] a[href]'), (link) =>
      pathFrom(link.href),
    );
    const categories = Array.from(panelElement.querySelectorAll<HTMLElement>("section"), (section) => ({
      headingHref: section.querySelector<HTMLAnchorElement>("h2 > a[href]")?.href ?? null,
      childHrefs: Array.from(section.querySelectorAll<HTMLAnchorElement>("ul a[href]"), (link) => link.href),
    }));

    return {
      tagName: panelElement.tagName,
      legacyCardCount: panelElement.querySelectorAll("[data-ctx-card-key]").length,
      legacyCopyPresent: panelElement.textContent?.includes("Browse by business") ?? false,
      categories,
      panelPaths,
      railPaths,
    };
  });

  expect(browseTree).not.toBeNull();
  expect(browseTree?.tagName).toBe("NAV");
  expect(browseTree?.legacyCardCount).toBe(0);
  expect(browseTree?.legacyCopyPresent).toBe(false);
  expect(browseTree?.categories.length).toBeGreaterThan(0);
  expect(browseTree?.panelPaths.length).toBeGreaterThan(0);
  expect(browseTree?.categories.every((category) => category.headingHref !== null)).toBe(true);
  expect(browseTree?.categories.every((category) => category.childHrefs.length > 0)).toBe(true);

  const railPaths = new Set(browseTree?.railPaths);
  for (const path of browseTree?.panelPaths ?? []) {
    expect(path).toMatch(/^\//);
    expect(railPaths).toContain(path);
  }

  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds?.width).toBeLessThanOrEqual(1152 + 1);
  expect(bounds?.width).toBeLessThanOrEqual(1280 - 32 + 1);

  // The centered panel intentionally spans the desktop rail. Its first
  // category must paint above that rail rather than being clipped behind it.
  const firstCategoryHit = await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    const link = target?.closest<HTMLAnchorElement>("a[href]");
    return {
      href: link?.getAttribute("href") ?? null,
      isInsideBrowsePanel: Boolean(target?.closest("[data-ctx-panel]")),
    };
  }, { x: (bounds?.x ?? 0) + 48, y: (bounds?.y ?? 0) + 36 });
  expect(firstCategoryHit).toEqual({ href: "/company", isInsideBrowsePanel: true });

  await page.mouse.move(0, 800);
  await expect(panel).toBeHidden();

  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("rendered demo copy and metadata remain English-only", async ({ page }) => {
  await page.goto("/company/message/");

  const rendered = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    body: document.body.innerText,
    metadata: Array.from(
      document.querySelectorAll<HTMLMetaElement | HTMLTitleElement>(
        'title, meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]',
      ),
      (element) => element instanceof HTMLTitleElement ? element.textContent ?? "" : element.content,
    ),
  }));

  expect(rendered.lang).toBe("en");
  expect(rendered.body).not.toMatch(JAPANESE_SCRIPT);
  expect(rendered.metadata.join("\n")).not.toMatch(JAPANESE_SCRIPT);
  expect(rendered.metadata.every((value) => /[A-Za-z]/.test(value))).toBe(true);
});

test("MDX routes render the seven local categories and the corporate fallback", async ({ page }) => {
  for (const imageCase of IMAGE_CASES) {
    await page.goto(imageCase.path);

    const images = page.locator(`main img[src="/images/dummy/${imageCase.category}.webp"]`);
    await expect(images.first()).toBeAttached();

    const imageDetails = await images.evaluateAll((elements) =>
      elements.map((image) => ({
        alt: image.getAttribute("alt") ?? "",
        width: image.getAttribute("width"),
        height: image.getAttribute("height"),
        src: image.getAttribute("src"),
      })),
    );
    expect(imageDetails.length).toBeGreaterThan(0);
    expect(imageDetails.every((image) => image.src === `/images/dummy/${imageCase.category}.webp`)).toBe(true);
    expect(imageDetails.every((image) => image.width === "1600" && image.height === "1000")).toBe(true);
    expect(imageDetails.every((image) => /[A-Za-z]/.test(image.alt) && !JAPANESE_SCRIPT.test(image.alt))).toBe(true);

    if ("fallback" in imageCase && imageCase.fallback) {
      expect(imageDetails.some((image) => image.src === "/images/dummy/corporate.webp")).toBe(true);
    }
  }
});
