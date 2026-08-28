"use client";

/**
 * NewsFilterEnhancer — client island wiring NewsFilter's buttons to show/hide
 * NewsList's rows. Renders nothing (`null`); it only attaches behavior to the
 * SSR markup NewsFilter/NewsList already produced. Mounted by the consuming
 * app, not wrapped in `<Island>` here — @zudo-sg/ui takes no zfb dependency
 * (see news-filter.tsx's header comment for the full DOM contract).
 *
 * Without this island the filter buttons render but do nothing — NewsList's
 * SSR output already shows every row, so that's a fully-functional static
 * fallback, not a broken one.
 */
import { useEffect } from "preact/hooks";

function enhance(): () => void {
  const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-news-filter]"));
  if (roots.length === 0) return () => {};

  const cleanups: Array<() => void> = [];

  for (const root of roots) {
    // Scope to the enclosing <section> so multiple feeds on one page don't
    // cross-wire.
    const scope = root.closest("section") ?? document;
    const list = scope.querySelector<HTMLElement>("[data-news-list]");
    if (!list) continue;

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-news-filter-btn]"));
    const rows = Array.from(list.querySelectorAll<HTMLElement>("li[data-news-category]"));

    const apply = (active: string) => {
      for (const row of rows) {
        const cat = row.getAttribute("data-news-category") ?? "";
        row.hidden = active !== "" && cat !== active;
      }
      for (const btn of buttons) {
        const cat = btn.getAttribute("data-category") ?? "";
        btn.setAttribute("aria-pressed", cat === active ? "true" : "false");
      }
    };

    for (const btn of buttons) {
      const onClick = () => apply(btn.getAttribute("data-category") ?? "");
      btn.addEventListener("click", onClick);
      cleanups.push(() => btn.removeEventListener("click", onClick));
    }
  }

  return () => cleanups.forEach((fn) => fn());
}

export default function NewsFilterEnhancer() {
  useEffect(() => {
    const dispose = enhance();
    return dispose;
  }, []);
  return null;
}
