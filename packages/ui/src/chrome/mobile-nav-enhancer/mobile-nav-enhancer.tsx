"use client";

/**
 * MobileNavEnhancer — a11y layer on top of SiteNav's off-canvas drawer
 * (chrome/site-nav), which opens/closes via a pure-CSS checkbox hack
 * (`#zui-nav-toggle` peer). Without this island the drawer still opens and
 * closes — every trigger is a `<label for>` toggling the same checkbox. What
 * JS adds:
 *   1. Sync the toggle checkbox's `aria-expanded`/`aria-label` to real state.
 *   2. Escape closes the drawer and returns focus to the toggle.
 *   3. A focus trap while open (Tab cycles within the drawer).
 *   4. Body scroll lock while open.
 *   5. Auto-close + unlock on resize back to `sm+` (desktop uses the fixed
 *      rail, not the drawer).
 *   6. Enter/Space on the close `<label role="button">`, which native
 *      `<label>` doesn't map to a click.
 *
 * DOM hooks (must match site-nav.tsx):
 *   - toggle checkbox: `#zui-nav-toggle` (single source of open/closed truth)
 *   - drawer `<nav>`:  `#zui-nav-drawer`
 *   - close button:    `[data-nav-close]`
 *
 * Render-null enhancer: mount via the consumer's own
 * `<Island when="visible" ssrFallback={null}>` (required — evaluating this
 * island during SSR throws). It draws no DOM of its own.
 */
import { useEffect } from "preact/hooks";

const TOGGLE_ID = "zui-nav-toggle";
const DRAWER_ID = "zui-nav-drawer";
// Must match site-nav's `sm` breakpoint (Tailwind default `--breakpoint-sm: 640px`).
const SM_BREAKPOINT_PX = 640;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), label[for], [tabindex]:not([tabindex="-1"])';

function enhance(): () => void {
  const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
  const drawer = document.getElementById(DRAWER_ID);
  const closeBtn = document.querySelector<HTMLElement>("[data-nav-close]");
  if (!toggle || !drawer) return () => {};

  const cleanups: Array<() => void> = [];

  const syncToggle = (open: boolean) => {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  // Only currently-visible focusable elements (offsetParent guards against
  // ones hidden while the drawer is closed).
  const focusables = (): HTMLElement[] =>
    Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );

  const lockScroll = (lock: boolean) => {
    document.body.style.overflow = lock ? "hidden" : "";
  };

  const open = () => {
    syncToggle(true);
    lockScroll(true);
    focusables()[0]?.focus();
  };

  const close = (returnFocus: boolean) => {
    syncToggle(false);
    lockScroll(false);
    if (returnFocus && typeof toggle.focus === "function") toggle.focus();
  };

  // The checkbox's `change` is the single source of open/closed truth — CSS
  // and this island react to the same checkbox.
  const onToggleChange = () => {
    if (toggle.checked) open();
    else close(false);
  };
  toggle.addEventListener("change", onToggleChange);
  cleanups.push(() => toggle.removeEventListener("change", onToggleChange));

  const onKeyDown = (e: KeyboardEvent) => {
    if (!toggle.checked) return;
    if (e.key === "Escape") {
      e.preventDefault();
      toggle.checked = false;
      close(true);
      return;
    }
    if (e.key === "Tab") {
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !drawer.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener("keydown", onKeyDown);
  cleanups.push(() => document.removeEventListener("keydown", onKeyDown));

  // Desktop uses the fixed rail, not the drawer — don't leave it open+locked
  // if the viewport grows past the drawer breakpoint.
  const onResize = () => {
    if (window.innerWidth >= SM_BREAKPOINT_PX && toggle.checked) {
      toggle.checked = false;
      close(false);
    }
  };
  window.addEventListener("resize", onResize);
  cleanups.push(() => window.removeEventListener("resize", onResize));

  // A `<label role="button">` doesn't get a native Enter/Space activation.
  if (closeBtn) {
    const onCloseKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggle.checked = false;
        close(true);
      }
    };
    closeBtn.addEventListener("keydown", onCloseKey);
    cleanups.push(() => closeBtn.removeEventListener("keydown", onCloseKey));
  }

  syncToggle(toggle.checked); // usually unchecked, but covers bfcache restores
  if (toggle.checked) lockScroll(true);

  cleanups.push(() => lockScroll(false)); // never leave scroll locked on teardown

  return () => cleanups.forEach((fn) => fn());
}

export default function MobileNavEnhancer() {
  useEffect(() => {
    const dispose = enhance();
    return dispose;
  }, []);
  return null;
}
