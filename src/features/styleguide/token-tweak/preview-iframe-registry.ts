// Bridges the design-token tweaker to the styleguide preview iframes.
//
// HOW TOKEN TWEAKS REACH THE IFRAMES — two coexisting paths:
//
// A) Doc→preview MIRROR (legacy, retired separately in #77/H3b):
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
//
// B) Sink/relay API (#76/H3a): `applyPreviewVars` / `clearPreviewVars` let a
//    caller push overrides directly to every iframe WITHOUT routing through
//    the host <html>. The current overrides are kept in `previewOverrides`
//    (the single source of truth), and that map is REPLAYED to any iframe once
//    it signals `onIframeReady` — so a late-mounted or re-mounted iframe still
//    receives the active tweaks. Both paths coexist until the mirror is
//    retired in #77/H3b.

import {
  sendApplyCssVars,
  sendClearCssVars,
  onIframeReady,
  type CssVarPair,
} from "@takazudo/zudo-doc/theme";

const registered = new Set<HTMLIFrameElement>();
const readyTeardowns = new Map<HTMLIFrameElement, () => void>();

/**
 * Current preview overrides pushed via the sink API (`applyPreviewVars` /
 * `clearPreviewVars`), keyed by custom-property name. This is the single
 * source of truth for "what overrides are currently active" and is replayed to
 * each iframe on `onIframeReady`.
 */
const previewOverrides = new Map<string, string>();

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

/** Snapshot the current sink overrides as bridge `[name, value]` pairs. */
function overridePairs(): CssVarPair[] {
  return [...previewOverrides].map(([name, value]) => [name, value] as const);
}

/**
 * Replay the current sink overrides onto one iframe. Called on `onIframeReady`
 * so a late-mounted or re-mounted iframe receives the active tweaks once its
 * receiver is installed.
 */
function replaySinkOverrides(iframe: HTMLIFrameElement): void {
  const pairs = overridePairs();
  if (pairs.length > 0) sendApplyCssVars(iframe, pairs);
}

/**
 * Push overrides to every registered preview iframe (sink/relay API). Upserts
 * each pair into the current-override map so it is replayed to iframes that
 * register or re-mount later.
 */
export function applyPreviewVars(
  pairs: ReadonlyArray<CssVarPair>,
): void {
  if (pairs.length === 0) return;
  for (const [name, value] of pairs) previewOverrides.set(name, value);
  for (const iframe of registered) sendApplyCssVars(iframe, pairs);
}

/**
 * Remove overrides from every registered preview iframe (sink/relay API).
 * Deletes each name from the current-override map so it is no longer replayed.
 */
export function clearPreviewVars(names: ReadonlyArray<string>): void {
  if (names.length === 0) return;
  for (const name of names) previewOverrides.delete(name);
  for (const iframe of registered) sendClearCssVars(iframe, names);
}

/** Register a preview iframe so future token tweaks are pushed to it. Idempotent. */
export function registerPreviewIframe(iframe: HTMLIFrameElement): void {
  if (registered.has(iframe)) return;
  registered.add(iframe);
  ensureObserver();

  // On ready, sync both paths: the legacy host-<html> mirror AND the current
  // sink overrides. Replaying on ready (not merely on DOM registration) is what
  // lets a late-mounted iframe pick up tweaks that were applied before it booted.
  const teardown = onIframeReady(iframe.contentWindow, () => {
    syncIframe(iframe);
    replaySinkOverrides(iframe);
  });
  readyTeardowns.set(iframe, teardown);
  // Also attempt an immediate sync (covers already-loaded iframes).
  syncIframe(iframe);
  replaySinkOverrides(iframe);
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
