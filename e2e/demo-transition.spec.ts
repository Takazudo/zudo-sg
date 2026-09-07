import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Demo SPA transition regression suite.
 *
 * Continuously verifies — post-deploy — that internal nav links soft-navigate
 * (SPA swap, no full reload) and that the load-bearing transition state is
 * preserved / re-synced across a swap:
 *
 *   1. Soft-nav (no full reload): a `window` sentinel survives the navigation.
 *   2. Rail DOM persistence: the `#zui-nav-drawer` node is the SAME element
 *      after the swap (a sentinel property set before the swap survives) —
 *      driven by `data-zfb-transition-persist`.
 *   3. Active-section re-sync: `[data-nav-item][data-current="true"]` moves to
 *      the section that owns the destination route (nav-sync.ts on
 *      `zfb:after-swap`).
 *   4. Loading overlay present: `#zd-page-loading-overlay` exists in the DOM.
 *   5. Loading overlay actually shows: it gains `data-visible` (and paints —
 *      computed `opacity`/`visibility`, not just the attribute) while a swap is
 *      in flight, then loses it once the swap lands.
 *
 * Selector policy: the content tree will keep changing, so anchor on STABLE
 * structural `data-*` / id hooks only:
 *   - rail:            #zui-nav-drawer (site-nav.tsx NAV_DRAWER_ID)
 *   - section item:    [data-nav-item] (a <details> per nav section)
 *   - active flag:     [data-current="true"] (set by nav-sync.ts)
 *   - loading overlay: #zd-page-loading-overlay (page-loading-overlay.tsx)
 *
 * Runs against the built demo dist served by the `demo-smoke` Playwright
 * project (DEMO_SMOKE_PORT) — no live deploy required.
 */

const SENTINEL_KEY = "__demoNavProbe";
const RAIL_MARKER = "demo-nav-rail";

interface ProbeWindow extends Window {
  [SENTINEL_KEY]?: string;
}

/**
 * Expand every rail section (`<details data-nav-item>`) so its leaf links are
 * clickable regardless of which section is open by default. Returns the list
 * of in-rail internal leaf hrefs (normalized, no trailing slash).
 */
async function openRailAndListLeafHrefs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const drawer = document.getElementById("zui-nav-drawer");
    if (!drawer) return [];
    drawer.querySelectorAll<HTMLDetailsElement>("details[data-nav-item]").forEach((d) => {
      d.open = true;
    });
    const hrefs = new Set<string>();
    drawer.querySelectorAll<HTMLAnchorElement>('[role="group"] a[href^="/"]').forEach((a) => {
      const path = new URL(a.href, location.origin).pathname.replace(/\/+$/, "") || "/";
      hrefs.add(path);
    });
    return [...hrefs];
  });
}

/** Normalize a URL pathname the way the rail hrefs are normalized (no trailing slash). */
function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

/** The in-rail leaf link pointing at `href` (with or without a trailing slash). */
function railLink(page: Page, href: string) {
  return page
    .locator(`#zui-nav-drawer a[href="${href}"], #zui-nav-drawer a[href="${href}/"]`)
    .first();
}

/** Wait for the SPA URL to settle on `href`. */
async function waitForSoftNav(page: Page, href: string): Promise<void> {
  await page.waitForURL((url) => normalizePath(url.pathname) === href, {
    waitUntil: "domcontentloaded",
  });
}

/** Click an in-rail link to `href` and wait for the SPA URL change. */
async function softNavTo(page: Page, href: string): Promise<void> {
  await railLink(page, href).click();
  await waitForSoftNav(page, href);
}

/**
 * Park the client router's page fetch for `href` so the overlay's 150 ms
 * show-delay timer always wins, then release it on demand.
 *
 * Why this interception point: the router dispatches
 * `zfb:before-preparation` synchronously and only then awaits its loader's
 * `fetch(to.href)` (zfb-runtime `client-router/events.js` doPreparation →
 * `router.js` defaultLoader → fetchHTML). The overlay's inline bootstrap starts
 * its `setTimeout(show, 150)` on that same event, so holding that one request
 * freezes the navigation exactly inside the window where the overlay is meant
 * to appear — for as long as the assertions need, with no sleep racing the
 * timer. zfb-runtime does ship a prefetch module (client-router/prefetch.js,
 * default strategy "hover"), but it only wires listeners from prefetchInit(),
 * which `<ClientRouter />` calls solely under `prefetchAll` — and the demo
 * mounts `<ClientRouter />` (layouts/default.tsx) bare, in <head>, never
 * hydrated. So no prefetch runs here and the navigation fetch is the only
 * request to this path; enabling prefetch would need this helper revisited.
 */
async function holdNavigationFetch(page: Page, href: string): Promise<{ release: () => void }> {
  let openGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });

  const routeHandler = async (route: Route) => {
    await gate;
    // The page can already be torn down if an assertion failed while the
    // request was parked; a rejected continue() would mask the real failure.
    await route.continue().catch(() => {});
  };

  // Scoped to this one pathname, and `page` is a per-test fixture, so the
  // registration cannot outlive the test or park an unrelated request. A
  // redirect re-entering the handler after release passes straight through,
  // since resolving a settled promise is a no-op.
  await page.route((url) => normalizePath(url.pathname) === href, routeHandler);

  /** Let the parked navigation request through. Idempotent. */
  return { release: () => openGate() };
}

test("internal nav click soft-navigates without a full reload (window sentinel survives)", async ({
  page,
}) => {
  // Start on a section page so its rail links are present; then expand all.
  await page.goto("/company/");
  await page.evaluate((key) => {
    (window as ProbeWindow)[key as typeof SENTINEL_KEY] = "kept";
  }, SENTINEL_KEY);

  const hrefs = await openRailAndListLeafHrefs(page);
  const target = hrefs.find((h) => h !== "/company" && h !== "/");
  expect(target, "expected at least one non-company rail leaf link").toBeTruthy();

  await softNavTo(page, target!);

  const probe = await page.evaluate((key) => (window as ProbeWindow)[key as typeof SENTINEL_KEY], SENTINEL_KEY);
  expect(probe, "a full reload would drop the window sentinel").toBe("kept");
});

test("rail persist node survives an SPA swap (and still holds #zui-nav-drawer)", async ({
  page,
}) => {
  await page.goto("/company/");

  // The persisted unit is the `display:contents` wrapper carrying
  // data-zfb-transition-persist="sidebar-main" (SiteNav itself renders a fixed
  // <nav> and can't take the attribute — see layouts/default.tsx). Tag THAT
  // node and confirm the rail lives inside it.
  const tagged = await page.evaluate((marker) => {
    const persist = document.querySelector<HTMLElement & { __railMarker__?: string }>(
      '[data-zfb-transition-persist="sidebar-main"]',
    );
    if (!persist) return { found: false, hasRail: false };
    persist.__railMarker__ = marker;
    return { found: true, hasRail: !!persist.querySelector("#zui-nav-drawer") };
  }, RAIL_MARKER);
  expect(tagged.found, "sidebar-main persist wrapper should exist").toBe(true);
  expect(tagged.hasRail, "#zui-nav-drawer should live inside the persist wrapper").toBe(true);

  const hrefs = await openRailAndListLeafHrefs(page);
  const target = hrefs.find((h) => h !== "/company" && h !== "/");
  expect(target).toBeTruthy();
  await softNavTo(page, target!);

  // If persistence is not wired the body swap discards the wrapper node and the
  // marker property is gone.
  const marker = await page.evaluate(() => {
    const persist = document.querySelector<HTMLElement & { __railMarker__?: string }>(
      '[data-zfb-transition-persist="sidebar-main"]',
    );
    return persist?.__railMarker__ ?? null;
  });
  expect(marker, "sidebar-main persist node should survive the SPA swap").toBe(RAIL_MARKER);
});

test("active section [data-current] re-syncs to the destination route after a swap", async ({
  page,
}) => {
  await page.goto("/company/");

  const hrefs = await openRailAndListLeafHrefs(page);
  // Pick a destination in a DIFFERENT top-level section than /company.
  const target = hrefs.find((h) => {
    const seg = h.split("/")[1] ?? "";
    return seg !== "" && seg !== "company";
  });
  expect(target, "expected a rail leaf outside the company section").toBeTruthy();

  await softNavTo(page, target!);

  // nav-sync.ts re-syncs data-current on `zfb:after-swap`, which fires just
  // AFTER waitForURL(domcontentloaded) resolves — poll rather than read once.
  // After it runs, exactly the section owning `target` should be data-current,
  // proven by that section containing a child link matching the destination.
  await expect
    .poll(
      () =>
        page.evaluate((dest) => {
          const current = document.querySelector<HTMLElement>(
            "[data-nav-item][data-current='true']",
          );
          if (!current) return false;
          const links = current.querySelectorAll<HTMLAnchorElement>('[role="group"] a[href]');
          for (const link of links) {
            const p = new URL(link.href, location.origin).pathname.replace(/\/+$/, "") || "/";
            if (p === dest) return true;
          }
          return false;
        }, target!),
      {
        message: "[data-current] should move to the destination's section after the swap",
        timeout: 5_000,
      },
    )
    .toBe(true);
});

test("loading overlay element is present in the DOM", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#zd-page-loading-overlay")).toBeAttached();
});

test("loading overlay becomes visible while a swap is in flight, and hides after it lands", async ({
  page,
}) => {
  await page.goto("/company/");

  const hrefs = await openRailAndListLeafHrefs(page);
  const target = hrefs.find((h) => h !== "/company" && h !== "/");
  expect(target, "expected at least one non-company rail leaf link").toBeTruthy();

  const overlay = page.locator("#zd-page-loading-overlay");
  // Baseline: idle means attached but not painted. Without this a permanently
  // visible overlay would satisfy the in-flight assertions below.
  await expect(overlay).toBeAttached();
  await expect(overlay).not.toHaveAttribute("data-visible");
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(overlay).toHaveCSS("opacity", "0");

  const held = await holdNavigationFetch(page, target!);

  try {
    // Do NOT wait for the URL here: it only changes once the swap runs, which
    // cannot happen while the response is parked.
    await railLink(page, target!).click();

    await expect(overlay).toHaveAttribute("data-visible", "");
    await expect(overlay).toHaveAttribute("aria-hidden", "false");
    // The attributes alone would still pass if the CSS stopped revealing it —
    // `.page-loading-overlay[data-visible]` is what flips opacity/visibility,
    // and both assertions retry past the 200ms fade.
    await expect(overlay).toHaveCSS("visibility", "visible");
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(overlay).toBeVisible();
  } finally {
    // Always release, including on assertion failure, so the parked handler
    // cannot outlive the test.
    held.release();
  }

  // The swap replaces the body, so this is a freshly rendered overlay node; the
  // URL change is what proves the navigation actually completed.
  await waitForSoftNav(page, target!);
  await expect(overlay).not.toHaveAttribute("data-visible");
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
});
