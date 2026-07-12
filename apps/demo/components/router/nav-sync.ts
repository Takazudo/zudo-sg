/**
 * nav-sync — re-syncs the persistent left nav rail's active-section state
 * after a soft (SPA) navigation.
 *
 * Problem: the left rail (`<nav id="zui-nav-drawer">`, see
 * `@zudo-sg/ui/src/chrome/site-nav`) is persisted across SPA swaps via
 * `data-zfb-transition-persist` (View Transitions — wired in a later wave),
 * so its DOM node survives navigation. The new page's freshly-rendered rail
 * markup (with the correct `data-current`/`open` state) is discarded as part
 * of that persistence, so without this the *previous* page's active section
 * stays highlighted/expanded after navigating.
 *
 * Fix: re-sync on `zfb:after-swap`. Registered once at module scope (an
 * island's `useEffect` would miss the event — zfb unmounts the island before
 * dispatching `AFTER_SWAP`); `document` itself persists across swaps.
 * Imported as a side effect from client-router-bootstrap.tsx so it loads on
 * the same schedule as the router.
 *
 * `[data-nav-item]` is a `<details>` element (accordion section). After a
 * swap this (a) sets `data-current`/opens the `<details>` for the section
 * matching the new URL and (b) closes the others. `open` is read as the
 * ground truth — the site-nav's `nav-enhancer` island syncs `aria-expanded`
 * off the `toggle` event this triggers.
 *
 * Matching the current section mirrors the server-side `isCurrentSection`
 * in `@zudo-sg/ui/src/chrome/site-nav/site-nav.tsx`: normalize each child
 * link's href and the section-top href, compare against the current
 * pathname.
 */
import { TRANSITION_AFTER_SWAP } from "@takazudo/zfb-runtime/client-router";

/** Mobile drawer toggle checkbox id — must match site-nav.tsx's `NAV_TOGGLE_ID`. */
const TOGGLE_ID = "zui-nav-toggle";

/** Normalizes `location.pathname` the same way `slugToHref`/`normalizeSlug` do. */
function currentHref(): string {
  const pathname = location.pathname;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized;
}

/** Whether a `[data-nav-item]` (`<details>`) is the section containing the current page. */
function isCurrentItem(item: HTMLElement, nowHref: string): boolean {
  const childLinks = item.querySelectorAll<HTMLAnchorElement>('[role="group"] a[href]');
  for (const link of childLinks) {
    const linkPath = new URL(link.href, location.origin).pathname;
    const linkNorm = linkPath.replace(/\/+$/, "") || "/";
    if (linkNorm === nowHref) return true;
  }
  return false;
}

function handleAfterSwap(): void {
  const nowHref = currentHref();

  const items = document.querySelectorAll<HTMLDetailsElement>("[data-nav-item]");
  for (const item of items) {
    if (isCurrentItem(item, nowHref)) {
      item.setAttribute("data-current", "true");
      item.open = true; // fires `toggle`, which mobile-nav-enhancer/nav-enhancer re-sync off of
    } else {
      item.removeAttribute("data-current");
      if (item.open) item.open = false;
    }
  }

  // Close the mobile drawer + unlock scroll if a nav link was tapped while it was open.
  const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
  if (toggle && toggle.checked) {
    toggle.checked = false;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
  }
}

// Module-scope registration guard — survives HMR/multiple imports.
declare global {
  // eslint-disable-next-line no-var
  var __zdDemoNavSyncBound: boolean | undefined;
}

// `document` doesn't exist during SSR/config evaluation — only bind client-side.
if (typeof document !== "undefined" && !globalThis.__zdDemoNavSyncBound) {
  document.addEventListener(TRANSITION_AFTER_SWAP, handleAfterSwap);
  globalThis.__zdDemoNavSyncBound = true;
}
