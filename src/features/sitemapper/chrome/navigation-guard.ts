// SPA-router navigation guard for `/sitemapper` (issue #409).
//
// The zfb client router can soft-swap a same-origin route without unloading
// this document. A native `beforeunload` listener alone therefore cannot warn
// when a shared-header link leaves the Sitemapper while the current sitemap is
// dirty. We layer two listeners:
//
// 1. `BEFORE_NAVIGATE_EVENT` (`zfb:before-preparation`) runs before the router
//    fetches or swaps a page. Calling `preventDefault()` on this event is
//    deliberately counter-intuitive: it does NOT cancel navigation and keep
//    the user on the page. zfb responds to the prevented preparation by
//    falling back to `location.href = to.href`, i.e. a hard navigation.
// 2. The native `beforeunload` listener then arms the browser's own leave-page
//    prompt for that hard navigation (and for reloads, tab closes, and typed
//    URLs). The browser controls the displayed text.
//
// That preventDefault → hard-navigation indirection is the behavior we need:
// it re-arms `beforeunload` for a header click instead of silently losing the
// dirty sitemap. It is not a bug or an attempt to provide an in-app cancel.

import { BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

/** Minimal shape this module needs from the router's before-navigate event. */
export interface CancelableNavigationEvent {
  preventDefault(): void;
}

/** Build the raw before-preparation listener for unit tests and installation. */
export function createBeforeNavigateHandler(
  hasUnsavedChanges: () => boolean,
): (event: CancelableNavigationEvent) => void {
  return (event) => {
    if (hasUnsavedChanges()) event.preventDefault();
  };
}

/** Build the native browser leave-page handler. */
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
 * Install both Sitemapper navigation guards for the island lifetime.
 * Returns a disposer suitable for a Preact effect cleanup.
 */
export function installSitemapperNavigationGuard(hasUnsavedChanges: () => boolean): () => void {
  const beforeNavigate = createBeforeNavigateHandler(hasUnsavedChanges) as EventListener;
  const beforeUnload = createBeforeUnloadHandler(hasUnsavedChanges);
  document.addEventListener(BEFORE_NAVIGATE_EVENT, beforeNavigate);
  window.addEventListener("beforeunload", beforeUnload);
  return () => {
    document.removeEventListener(BEFORE_NAVIGATE_EVENT, beforeNavigate);
    window.removeEventListener("beforeunload", beforeUnload);
  };
}

// Explicit aliases make the small, controller-neutral API convenient for
// consumers that keep all Sitemapper chrome helpers namespaced at call sites.
export const createSitemapperBeforeNavigateHandler = createBeforeNavigateHandler;
export const createSitemapperBeforeUnloadHandler = createBeforeUnloadHandler;
export const installNavigationGuard = installSitemapperNavigationGuard;
