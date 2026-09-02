import { expect, test, type Page } from "@playwright/test";

// /components as a visual catalogue rendered INLINE (#540).
//
// The page's whole point is that it shows components rather than describing
// them, so these checks are about the things a screenshot would tell you:
// the band is wide, every tile carries a real rendered component, nothing is
// an iframe, and none of it depends on JavaScript. The interaction layer
// (filter, category chips, "/" shortcut, tile size) is checked on top.
//
// Owned exclusively by this task — the shared catalogue assertions in
// smoke.spec.ts are reconciled separately (#542).

const CATALOG = "/components";

/** Resolve a CSS custom property to the same rgb string getComputedStyle returns. */
async function resolveColor(page: Page, cssVar: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, cssVar);
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test.describe("catalogue gallery", () => {
  test("uses zudo-doc's wide content band", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CATALOG);

    const band = page.locator(".zd-doc-content-band");
    await expect(band).toHaveAttribute("data-zd-wide", "");

    // The default band caps at clamp(50rem, 75vw, 90rem) → 1080px at 1440.
    // `contentWide` lifts it to clamp(50rem, 92.5vw, 120rem) → 1332px, of
    // which the sidebar leaves ~1152. Measured 1152 at 1440x900.
    const width = await band.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThanOrEqual(1150);
  });

  test("keeps prose at a reading measure inside the wide band", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CATALOG);

    // A wide band must not mean 1150px-wide paragraphs.
    const lead = page.locator("[data-sg-catalog-intro]");
    const width = await lead.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(960);
  });

  test("renders every component inline, with no preview iframes", async ({ page }) => {
    await page.goto(CATALOG);

    await expect(page.locator("iframe")).toHaveCount(0);

    const tiles = page.locator("[data-sg-tile]");
    const cards = page.locator("[data-sg-card]");
    const tileCount = await tiles.count();
    expect(tileCount).toBeGreaterThan(0);
    await expect(cards).toHaveCount(tileCount);

    // The lead paragraph states the catalogue size; a tile missing from the
    // grid (or an extra one) shows up as a mismatch here rather than as a
    // number this spec has to be edited to track.
    const lead = await page.locator("[data-sg-catalog-intro]").innerText();
    expect(lead).toContain(`${tileCount} components`);

    // A documented opt-out renders a `.sg-thumb-note` carrying its reason; an
    // unexplained blank tile is a bug, not a design choice.
    const empty = await page.evaluate(() =>
      [...document.querySelectorAll("[data-sg-tile]")]
        .filter((tile) => {
          const note = tile.querySelector(".sg-thumb-note");
          if (note) return !note.textContent?.trim();
          const inner = tile.querySelector(".sg-thumb-inner");
          return !inner || inner.children.length === 0;
        })
        .map(
          (tile) =>
            tile.querySelector(".sg-tile-title")?.textContent ?? "unnamed",
        ),
    );
    expect(empty).toEqual([]);
  });

  test("keeps every card link navigable", async ({ page }) => {
    await page.goto(CATALOG);

    const firstCard = page.locator("[data-sg-card]").first();
    const href = await firstCard.getAttribute("href");
    expect(href).toBeTruthy();

    // The rendered component is a SIBLING of the anchor, never inside it —
    // interactive content in an <a> makes the parser close the anchor early
    // and shatters the card.
    await expect(firstCard.locator(".sg-thumb")).toHaveCount(0);

    const response = await page.goto(href!);
    expect(response?.status()).toBe(200);
  });

  test("keeps thumbnails out of the tab order", async ({ page }) => {
    await page.goto(CATALOG);
    const focusable = await page.locator(".sg-thumb :is(a, button, input, select, textarea)").count();
    // The snapshots render plenty of controls; `inert` must keep every one of
    // them unreachable, so tabbing from the search box lands on page chrome.
    expect(focusable).toBeGreaterThan(0);
    // `el.inert` is only true on the element carrying the attribute, not on its
    // descendants, so the honest check is whether focus actually lands.
    const reachable = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>(".sg-thumb a, .sg-thumb button")].filter(
          (el) => {
            el.focus();
            return document.activeElement === el;
          },
        ).length,
    );
    expect(reachable).toBe(0);
  });

  test("has no horizontal page scroll at any breakpoint, in either tile size", async ({
    page,
  }) => {
    await page.goto(CATALOG);
    for (const size of ["compact", "large"]) {
      await page.evaluate((value) => {
        document.documentElement.setAttribute("data-sg-tile-size", value);
      }, size);
      for (const width of [1440, 1280, 1024, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await hasHorizontalScroll(page),
          `horizontal scroll at ${width}px (${size})`,
        ).toBe(false);
      }
    }
  });
});

test.describe("catalogue filter", () => {
  test("hides the whole tile, its section, and shows the empty state", async ({
    page,
  }) => {
    await page.goto(CATALOG);
    const search = page.locator(".sg-search-input");
    await expect(search).toBeVisible();

    const visibleTiles = () =>
      page.locator("[data-sg-tile]:not([hidden])").count();
    const total = await visibleTiles();

    await search.fill("hero");
    await expect
      .poll(visibleTiles, { message: "tiles narrow to the query" })
      .toBeLessThan(total);
    // Hiding only the anchor would leave the rendered thumbnail behind.
    const orphanThumbs = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-sg-tile][hidden]")].filter(
          (tile) => tile.getBoundingClientRect().height > 0,
        ).length,
    );
    expect(orphanThumbs).toBe(0);
    expect(
      await page.locator("[data-sg-section]:not([hidden])").count(),
    ).toBeLessThan(await page.locator("[data-sg-section]").count());

    await search.fill("zzzz-no-such-component");
    await expect(page.locator("[data-sg-empty]")).toBeVisible();
    expect(await visibleTiles()).toBe(0);

    await search.fill("");
    await expect.poll(visibleTiles).toBe(total);
  });

  test("filters by category chip and focuses search with /", async ({ page }) => {
    await page.goto(CATALOG);

    const forms = page.locator(".sg-chip", { hasText: "Forms" });
    await forms.click();
    await expect(forms).toHaveAttribute("aria-pressed", "true");
    // Poll rather than read once: `aria-pressed` flips with the chip's own
    // render, but the tile hiding it implies runs in a `useEffect` a tick
    // later, so a single `evaluate` here races the filter under load. The
    // visible-tile assertions above already use `expect.poll` for the same
    // reason; this one spot did not, and flaked once in four full runs.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Set(
              [
                ...document.querySelectorAll("[data-sg-tile]:not([hidden])"),
              ].map((tile) =>
                tile
                  .querySelector("[data-sg-card]")
                  ?.getAttribute("data-category"),
              ),
            ).size,
        ),
      )
      .toBe(1);

    await page.locator("h1").first().click();
    await page.keyboard.press("/");
    await expect(page.locator(".sg-search-input")).toBeFocused();
  });
});

test.describe("tile-size control", () => {
  test("defaults to Compact and switches the grid track", async ({ page }) => {
    await page.goto(CATALOG);

    const compact = page.locator(".sg-seg-btn", { hasText: "Compact" });
    const large = page.locator(".sg-seg-btn", { hasText: "Large" });
    await expect(compact).toHaveAttribute("aria-pressed", "true");
    await expect(large).toHaveAttribute("aria-pressed", "false");

    const trackCount = () =>
      page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector(".sg-grid")!,
          ).gridTemplateColumns.split(" ").length,
      );
    const compactTracks = await trackCount();

    await large.click();
    await expect(large).toHaveAttribute("aria-pressed", "true");
    expect(await trackCount()).toBeLessThan(compactTracks);
  });

  test("survives a reload", async ({ page }) => {
    await page.goto(CATALOG);
    await page.locator(".sg-seg-btn", { hasText: "Large" }).click();
    await page.reload();
    await expect(
      page.locator(".sg-seg-btn", { hasText: "Large" }),
    ).toHaveAttribute("aria-pressed", "true");
    // Restored before first paint by the head script, not after hydration.
    await expect(page.locator("html")).toHaveAttribute(
      "data-sg-tile-size",
      "large",
    );
  });

  test("degrades to Compact when localStorage throws", async ({ page }) => {
    await page.addInitScript(() => {
      const boom = () => {
        throw new Error("storage disabled");
      };
      for (const method of ["getItem", "setItem", "removeItem"]) {
        Object.defineProperty(Storage.prototype, method, {
          configurable: true,
          value: boom,
        });
      }
    });
    await page.goto(CATALOG);

    await expect(
      page.locator(".sg-seg-btn", { hasText: "Compact" }),
    ).toHaveAttribute("aria-pressed", "true");

    // The choice still applies for the session; only the persistence is lost.
    await page.locator(".sg-seg-btn", { hasText: "Large" }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-sg-tile-size",
      "large",
    );
  });

  test("marks the selected option without spending a filled accent", async ({
    page,
  }) => {
    await page.goto(CATALOG);
    const selected = page.locator('.sg-seg-btn[aria-pressed="true"]');
    const background = await selected.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const accent = await resolveColor(page, "--color-accent");
    expect(background).not.toBe(accent);
    expect(background).not.toBe("rgba(0, 0, 0, 0)");

    // The selection marker is the ::after underline, not the fill.
    const marker = await selected.evaluate((el) => {
      const style = getComputedStyle(el, "::after");
      return { content: style.content, height: style.height };
    });
    expect(marker.content).not.toBe("none");
    expect(parseFloat(marker.height)).toBeGreaterThan(0);
    expect(parseFloat(marker.height)).toBeLessThanOrEqual(4);
  });
});

test.describe("with JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false });

  test("still shows every rendered component and every link", async ({ page }) => {
    await page.goto(CATALOG);

    await expect(page.locator("iframe")).toHaveCount(0);
    const tiles = await page.locator("[data-sg-tile]").count();
    expect(tiles).toBeGreaterThan(0);

    const filled = await page.evaluate(
      () =>
        [...document.querySelectorAll(".sg-thumb")].filter((thumb) => {
          const inner = thumb.querySelector(".sg-thumb-inner");
          return inner
            ? inner.children.length > 0
            : Boolean(thumb.querySelector(".sg-thumb-note")?.textContent?.trim());
        }).length,
    );
    expect(filled).toBe(tiles);

    const hrefs = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-sg-card]")].filter((a) =>
          a.getAttribute("href"),
        ).length,
    );
    expect(hrefs).toBe(tiles);
  });
});
