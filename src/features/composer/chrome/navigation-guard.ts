// SPA-router navigation guard for `/composer` (issue #247).
//
// `dynamicPageTransition` (zfb's client router, settings.dynamicPageTransition)
// intercepts every same-origin left-click — including the persisted shared
// header — and soft-swaps the document. A soft swap tears down this
// client-only workspace WITHOUT ever firing `beforeunload`, so a plain
// `window.addEventListener("beforeunload", …)` guard alone is not enough:
// the browser's native "leave site?" prompt would never appear for a header
// click while there are unsaved edits.
//
// The fix layers two guards:
//
//  1. `BEFORE_NAVIGATE_EVENT` ("zfb:before-preparation") — the router fires
//     this *cancelable* event for every navigation it is about to perform
//     (link clicks, history traversal, programmatic `navigate()`), BEFORE it
//     fetches/swaps anything. Calling `event.preventDefault()` here does not
//     "cancel and stay" — reading the router's `transition()` function
//     (`@takazudo/zfb-runtime/client-router/router.js`), a prevented
//     preparation event makes the router abandon the SPA swap and fall back
//     to a real `location.href = to.href` navigation instead. That fallback
//     IS a genuine document unload, so it reaches guard #2 below.
//  2. The native `beforeunload` handler — fires for the fallback hard
//     navigation from #1, and for any other real unload (tab close, reload,
//     typing a new URL). The browser owns the confirmation UI here (custom
//     message text is ignored by modern browsers by design).
//
// Net effect: an in-app header click while the document has unsaved edits
// downgrades from an invisible SPA swap to a real navigation the browser's
// own "leave site?" prompt can intercept — one confirmation, not two.
//
// `onBeforeNavigate` (the friendly wrapper `@takazudo/zudo-doc/transitions`
// exports) types its handler as `() => void`, which doesn't expose the event
// object `preventDefault()` needs — so this module listens on the raw
// `BEFORE_NAVIGATE_EVENT` string directly instead of using that wrapper.

import { BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

/** Minimal shape this module needs from the router's before-navigate event. */
export interface CancelableNavigationEvent {
  preventDefault(): void;
}

/**
 * Builds the `BEFORE_NAVIGATE_EVENT` listener. Exported separately from
 * `installComposerNavigationGuard` so it can be unit-tested against a plain
 * mock event, with no `document`/router involved.
 */
export function createBeforeNavigateHandler(
  hasUnsavedChanges: () => boolean,
): (event: CancelableNavigationEvent) => void {
  return (event) => {
    if (hasUnsavedChanges()) event.preventDefault();
  };
}

/**
 * Builds the native `beforeunload` handler. Setting `returnValue` (and
 * returning a string, for older engines) is what triggers the browser's own
 * confirmation prompt; the actual displayed text is browser-controlled.
 */
export function createBeforeUnloadHandler(
  hasUnsavedChanges: () => boolean,
): (event: BeforeUnloadEvent) => string | undefined {
  return (event) => {
    if (!hasUnsavedChanges()) return undefined;
    event.preventDefault();
    event.returnValue = "";
    return "";
  };
}

/**
 * Wires both guards for the lifetime of the `/composer` island. Returns a
 * disposer that removes both listeners (call from a Preact `useEffect`
 * cleanup or equivalent teardown).
 */
export function installComposerNavigationGuard(hasUnsavedChanges: () => boolean): () => void {
  const beforeNavigate = createBeforeNavigateHandler(hasUnsavedChanges) as EventListener;
  const beforeUnload = createBeforeUnloadHandler(hasUnsavedChanges);
  document.addEventListener(BEFORE_NAVIGATE_EVENT, beforeNavigate);
  window.addEventListener("beforeunload", beforeUnload);
  return () => {
    document.removeEventListener(BEFORE_NAVIGATE_EVENT, beforeNavigate);
    window.removeEventListener("beforeunload", beforeUnload);
  };
}
