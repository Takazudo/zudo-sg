"use client";

/**
 * NavEnhancer — a11y layer on top of SiteNav's `<details>`/`<summary>` accordion
 * (chrome/site-nav).
 *
 * The accordion itself needs no JS: it opens/closes via native `<details>`
 * `open` + click/tap. Without this island it still works. What JS adds:
 *   1. Sync `aria-expanded` on `<summary>` to the real `open` state — the
 *      browser doesn't do this automatically on `toggle`.
 *   2. Escape closes the section that currently has focus inside it, and
 *      returns focus to its `<summary>`.
 *
 * DOM hooks (must match site-nav.tsx):
 *   - nav root: `nav[aria-label="Global navigation"]`
 *   - section:  `[data-nav-item]`    (the `<details>`)
 *   - trigger:  `[data-nav-trigger]` (the `<summary>`)
 *
 * No `aria-haspopup` — `<details>/<summary>` is an inline disclosure widget,
 * not a popup, so gate on `aria-expanded`'s presence (== hasChildren) instead.
 *
 * Render-null enhancer: mount via the consumer's own
 * `<Island when="visible" ssrFallback={null}>` (required — evaluating this
 * island during SSR throws). It draws no DOM of its own.
 */
import { useEffect } from "preact/hooks";

function enhance(): () => void {
  const nav = document.querySelector<HTMLElement>('nav[aria-label="Global navigation"]');
  if (!nav) return () => {};

  const items = Array.from(nav.querySelectorAll<HTMLDetailsElement>("[data-nav-item]"));

  const setExpanded = (item: HTMLDetailsElement, open: boolean) => {
    const trigger = item.querySelector<HTMLElement>("[data-nav-trigger]");
    if (trigger?.hasAttribute("aria-expanded")) {
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }
  };

  const cleanups: Array<() => void> = [];

  for (const item of items) {
    // `toggle` fires after the `open` attribute changes — the ground truth
    // for aria-expanded sync.
    const onToggle = () => setExpanded(item, item.open);
    item.addEventListener("toggle", onToggle);
    setExpanded(item, item.open); // initial sync for SSR-open sections
    cleanups.push(() => item.removeEventListener("toggle", onToggle));
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const active = document.activeElement as HTMLElement | null;
    const openItem = items.find((it) => it.open && it.contains(active));
    if (!openItem) return;
    openItem.open = false; // fires `toggle`, which re-syncs aria-expanded
    const summary = openItem.querySelector<HTMLElement>("[data-nav-trigger]");
    if (summary && typeof summary.focus === "function") summary.focus();
  };
  nav.addEventListener("keydown", onKeyDown);
  cleanups.push(() => nav.removeEventListener("keydown", onKeyDown));

  return () => cleanups.forEach((fn) => fn());
}

export default function NavEnhancer() {
  useEffect(() => {
    const dispose = enhance();
    return dispose;
  }, []);
  return null;
}
