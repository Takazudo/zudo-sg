"use client";

/**
 * ContextSwitcherEnhancer — a11y layer on top of SiteHeader's Browse category
 * panel (chrome/site-header), which discloses via pure CSS
 * (`group/ctx` hover / focus-within). Without this island the panel still
 * opens on hover/focus. What JS adds:
 *   1. Sync the trigger's `aria-expanded` to the real visible state — CSS
 *      hover/focus-within has no way to update an ARIA attribute itself, so
 *      SSR's "false" default would otherwise never change.
 *   2. Click-to-toggle: pointer hover opens the panel but can't be
 *      "clicked shut" or pinned open once the pointer leaves; a click makes
 *      opening an explicit, re-clickable action for mouse/touch/keyboard.
 *   3. Escape / outside-click closes a pinned-open panel.
 *
 * Intent state model (layered on top of the CSS baseline):
 *   "none"   — pure-CSS driven (hover / focus-within), no inline override.
 *   "open"   — pinned open by click; stays open (inline style) even if hover/
 *              focus leave, until outside-click / re-click / Escape.
 *   "closed" — forced shut by Escape / outside-click / re-click, even if
 *              hover/focus-within is still technically true. Re-entering with
 *              the pointer (`pointerenter`) clears this back to "none".
 *   `aria-expanded` always reflects the resulting real-visible state.
 *
 * DOM hooks (must match site-header.tsx; a separate contract from
 * site-nav's `data-nav-*`):
 *   - trigger: `[data-ctx-trigger]`
 *   - panel:   `[data-ctx-panel]`
 *
 * Idempotency: this project's SPA client-router can re-run islands on a soft
 * navigation without a full page reload, so re-running `enhance()` on the
 * same DOM must not double-bind. A `data-ctx-enhanced` guard on the disclosure's
 * common-ancestor scope (`.group\/ctx`) makes a second call a no-op; every
 * listener is tied to one `AbortController` so cleanup (which clears the
 * guard) always fully un-binds before a next mount re-enhances.
 *
 * Render-null enhancer: mount via the consumer's own
 * `<Island when="visible" ssrFallback={null}>` (required — evaluating this
 * island during SSR throws). It draws no DOM of its own.
 */
import { useEffect } from "preact/hooks";

type Intent = "none" | "open" | "closed";

function enhance(): () => void {
  const trigger = document.querySelector<HTMLElement>("[data-ctx-trigger]");
  const panel = document.querySelector<HTMLElement>("[data-ctx-panel]");
  if (!trigger || !panel) return () => {};

  // Common ancestor (site-header's `.group/ctx`) — the guard lives on this
  // one node. Falls back to the trigger itself if it can't be found.
  const scope = (trigger.closest<HTMLElement>(".group\\/ctx") as HTMLElement | null) ?? trigger;

  if (scope.dataset.ctxEnhanced === "true") return () => {};
  scope.dataset.ctxEnhanced = "true";

  const ac = new AbortController();
  const { signal } = ac;

  const setExpanded = (open: boolean) => {
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  };

  let intent: Intent = "none";

  // Pin open: override the CSS-closed defaults so the panel stays visible
  // regardless of hover/focus.
  const applyOpen = () => {
    intent = "open";
    panel.style.visibility = "visible";
    panel.style.opacity = "1";
    panel.style.pointerEvents = "auto";
    panel.style.translate = "none";
    panel.style.transform = "none";
  };
  // Force closed: override CSS hover/focus-within so it hides even while
  // still (technically) hovered/focused.
  const applyClosed = () => {
    intent = "closed";
    panel.style.visibility = "hidden";
    panel.style.opacity = "0";
    panel.style.pointerEvents = "none";
    panel.style.removeProperty("translate");
    panel.style.removeProperty("transform");
  };
  // Strip every inline override and hand control back to pure CSS.
  const clearForce = () => {
    intent = "none";
    panel.style.removeProperty("visibility");
    panel.style.removeProperty("opacity");
    panel.style.removeProperty("pointer-events");
    panel.style.removeProperty("translate");
    panel.style.removeProperty("transform");
  };

  const isOpen = (): boolean => {
    if (intent === "open") return true;
    if (intent === "closed") return false;
    return scope.matches(":hover") || scope.contains(document.activeElement);
  };

  // Deferred to a microtask: right after `focusout`, `document.activeElement`
  // is briefly `<body>` even when focus is only moving to another element
  // inside the scope, so reading real state immediately would misfire.
  const sync = () =>
    queueMicrotask(() => {
      if (signal.aborted) return;
      setExpanded(isOpen());
    });

  // Click = explicit toggle, based on what the user currently sees:
  //   visibly open (pinned, or CSS-hover-open on desktop) → close it.
  //   not visibly open (touch/keyboard has no hover, or force-closed) → open+pin it.
  // Checking hover (not focus) is what separates "desktop hover-open, click
  // wants to close" from "touch/keyboard click that focuses AND should open".
  trigger.addEventListener(
    "click",
    () => {
      const visiblyOpen = intent === "open" || (intent === "none" && scope.matches(":hover"));
      if (visiblyOpen) applyClosed();
      else applyOpen();
      sync();
    },
    { signal },
  );

  // Pointer re-entering = renewed intent to open; clears a forced-closed
  // state back to CSS-driven. A pinned-open state is left alone.
  scope.addEventListener(
    "pointerenter",
    () => {
      if (intent === "closed") clearForce();
      sync();
    },
    { signal },
  );
  scope.addEventListener("pointerleave", sync, { signal });
  scope.addEventListener("focusin", sync, { signal });
  // Focus leaving the scope entirely clears any forced state (open or
  // closed) back to CSS-driven — Tab-ing away closes a pinned panel too.
  scope.addEventListener(
    "focusout",
    (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !scope.contains(next)) clearForce();
      sync();
    },
    { signal },
  );

  // Escape closes if currently open, only returning focus to the trigger
  // when focus was already inside the disclosure (don't steal it from a
  // pinned-open panel the user is interacting with elsewhere).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (!isOpen()) return;
    const focusInside = scope.contains(document.activeElement) || panel.contains(document.activeElement);
    applyClosed();
    if (focusInside && typeof trigger.focus === "function") trigger.focus();
    sync();
  };
  document.addEventListener("keydown", onKeyDown, { signal });

  // Outside click closes a pinned-open panel. Clicks on the trigger itself
  // are left to the click handler's toggle; clicks inside the panel (card
  // links) are allowed to navigate.
  const onDocPointerDown = (e: PointerEvent) => {
    if (intent !== "open") return;
    const target = e.target as Node | null;
    if (target && (scope.contains(target) || panel.contains(target))) return;
    applyClosed();
    sync();
  };
  document.addEventListener("pointerdown", onDocPointerDown, { signal });

  sync(); // initial sync from SSR's "false" default

  return () => {
    ac.abort();
    clearForce();
    delete scope.dataset.ctxEnhanced;
  };
}

export default function ContextSwitcherEnhancer() {
  useEffect(() => {
    const dispose = enhance();
    return dispose;
  }, []);
  return null;
}
