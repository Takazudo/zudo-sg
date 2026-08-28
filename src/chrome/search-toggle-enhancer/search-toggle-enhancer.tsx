"use client";

/**
 * SearchToggleEnhancer — a11y layer on top of SiteHeader's search toggle
 * (chrome/site-header), which discloses via pure CSS (`group/search`
 * focus-within). Without this island, tabbing from the trigger into the
 * input still opens it and a plain GET form submit (`/search?q=`) still
 * works. What JS adds:
 *   1. Sync the trigger's `aria-expanded` to the real focus-within state.
 *   2. Click/tap focuses the input directly (focus-within alone opens on the
 *      trigger's own focus, but doesn't move the caret into the field).
 *   3. Escape collapses it (clears the input, refocuses the trigger, which
 *      drops focus-within and lets CSS close it).
 *
 * No pinned-open state (unlike the context switcher) — focus-within is the
 * only disclosure source this enhancer reads.
 *
 * DOM hooks (must match site-header.tsx; a separate contract from
 * `data-ctx-*` / `data-nav-*`):
 *   - scope:   `[data-search-form]`    (trigger + input's common `<form>`)
 *   - trigger: `[data-search-trigger]`
 *   - input:   `[data-search-input]`
 *
 * Idempotency: guards on `data-search-toggle-enhanced` (same rationale as
 * context-switcher-enhancer's `data-ctx-enhanced` — this project's SPA
 * client-router can re-run islands without a full reload).
 *
 * Render-null enhancer: mount via the consumer's own
 * `<Island when="visible" ssrFallback={null}>` (required — evaluating this
 * island during SSR throws). It draws no DOM of its own.
 */
import { useEffect } from "preact/hooks";

function enhance(): () => void {
  const form = document.querySelector<HTMLElement>("[data-search-form]");
  if (!form) return () => {};
  if (form.dataset.searchToggleEnhanced === "true") return () => {};

  const trigger = form.querySelector<HTMLButtonElement>("[data-search-trigger]");
  const input = form.querySelector<HTMLInputElement>("[data-search-input]");
  if (!trigger || !input) return () => {};

  form.dataset.searchToggleEnhanced = "true";
  const ac = new AbortController();
  const { signal } = ac;

  // Real visible state == focus-within, matching the CSS disclosure source.
  const isOpen = (): boolean => form.contains(document.activeElement);

  const syncExpanded = () => {
    trigger.setAttribute("aria-expanded", isOpen() ? "true" : "false");
  };

  // Click/tap = focus the input (opens it for touch/keyboard too). If the
  // input already has focus, clear it and return focus to the trigger
  // instead — a toggle-to-close.
  trigger.addEventListener(
    "click",
    () => {
      if (document.activeElement === input) {
        input.value = "";
        trigger.focus();
      } else {
        input.focus();
      }
      queueMicrotask(() => {
        if (!signal.aborted) syncExpanded();
      });
    },
    { signal },
  );

  // Deferred to a microtask: right after `focusout`, `document.activeElement`
  // is briefly `<body>` even when focus is only moving within the form.
  const syncDeferred = () =>
    queueMicrotask(() => {
      if (!signal.aborted) syncExpanded();
    });
  form.addEventListener("focusin", syncDeferred, { signal });
  form.addEventListener("focusout", syncDeferred, { signal });

  // Escape clears the input and returns focus to the trigger, which drops
  // focus-within and lets the pure-CSS baseline close it.
  input.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      input.value = "";
      trigger.focus();
      syncDeferred();
    },
    { signal },
  );

  syncExpanded(); // initial sync from SSR's "false" default

  return () => {
    ac.abort();
    delete form.dataset.searchToggleEnhanced;
  };
}

export default function SearchToggleEnhancer() {
  useEffect(() => {
    const dispose = enhance();
    return dispose;
  }, []);
  return null;
}
