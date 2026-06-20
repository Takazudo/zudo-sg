// Bridges the design-token tweaker to the styleguide preview iframes.
//
// HOW TOKEN TWEAKS REACH THE IFRAMES:
//   1. The host already runs zdtp (`configurePanel`) via the existing
//      design-token-panel-bootstrap. When a user drags a token, zdtp writes
//      the override as an inline `--zd-*` (and `--color-*`) custom property on
//      the MAIN document's <html> style.
//   2. This registry observes <html>'s `style` attribute (MutationObserver)
//      and, on any change, reads the inline custom properties and broadcasts
//      them to every registered preview iframe using zudo-doc's theme
//      iframe-bridge (`sendApplyCssVars` → `apply-css-vars` postMessage).
//   3. Inside each iframe, PreviewApp's `installIframeReceiver` applies those
//      pairs onto the iframe document's :root — so the preview live-updates.

import {
  sendApplyCssVars,
  sendClearCssVars,
  onIframeReady,
} from "@takazudo/zudo-doc/theme";

const registered = new Set<HTMLIFrameElement>();
const readyTeardowns = new Map<HTMLIFrameElement, () => void>();

/** Names broadcast on the previous sync, so we can clear ones that disappeared. */
let lastBroadcastNames: string[] = [];
let observer: MutationObserver | null = null;
let rafScheduled = false;

/**
 * Read every inline custom property (`--…`) currently set on <html>'s style.
 * These are the tweaker's live overrides (zdtp sets them inline).
 */
function readInlineVars(): Array<readonly [string, string]> {
  if (typeof document === "undefined") return [];
  const style = document.documentElement.style;
  const pairs: Array<readonly [string, string]> = [];
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (!name.startsWith("--")) continue;
    const value = style.getPropertyValue(name).trim();
    if (value) pairs.push([name, value] as const);
  }
  return pairs;
}

function syncIframe(iframe: HTMLIFrameElement): void {
  const pairs = readInlineVars();
  if (pairs.length > 0) sendApplyCssVars(iframe, pairs);
  // Seed lastBroadcastNames so that subsequent broadcast() calls can correctly
  // compute the diff (removed = names that existed last time but are now gone).
  // Without this, an initial sync bypasses the shared name list and the first
  // broadcast after a token reset (removing inline vars) sees no "removed"
  // names to clear — the iframe retains stale overrides. (#48 latent reset bug)
  const names = pairs.map(([n]) => n);
  if (names.length > 0) {
    const current = new Set(lastBroadcastNames);
    for (const n of names) current.add(n);
    lastBroadcastNames = [...current];
  }
}

function broadcast(): void {
  const pairs = readInlineVars();
  const names = pairs.map(([n]) => n);

  // Clear overrides that existed last time but are now gone (reset).
  const current = new Set(names);
  const removed = lastBroadcastNames.filter((n) => !current.has(n));
  for (const iframe of registered) {
    if (removed.length > 0) sendClearCssVars(iframe, removed);
    if (pairs.length > 0) sendApplyCssVars(iframe, pairs);
  }
  lastBroadcastNames = names;
}

function scheduleBroadcast(): void {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    broadcast();
  });
}

function ensureObserver(): void {
  if (observer || typeof document === "undefined") return;
  observer = new MutationObserver(scheduleBroadcast);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });
}

/** Register a preview iframe so future token tweaks are pushed to it. Idempotent. */
export function registerPreviewIframe(iframe: HTMLIFrameElement): void {
  if (registered.has(iframe)) return;
  registered.add(iframe);
  ensureObserver();

  // Sync current overrides as soon as the iframe document signals ready.
  const teardown = onIframeReady(iframe.contentWindow, () => syncIframe(iframe));
  readyTeardowns.set(iframe, teardown);
  // Also attempt an immediate sync (covers already-loaded iframes).
  syncIframe(iframe);
}

/** Stop pushing token tweaks to an iframe (on unmount). Idempotent. */
export function unregisterPreviewIframe(iframe: HTMLIFrameElement): void {
  registered.delete(iframe);
  const teardown = readyTeardowns.get(iframe);
  if (teardown) {
    teardown();
    readyTeardowns.delete(iframe);
  }
}
