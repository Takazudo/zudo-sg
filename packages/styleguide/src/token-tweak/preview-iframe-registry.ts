// Bridges the design-token tweaker to the styleguide preview iframes.
//
// HOW TOKEN TWEAKS REACH THE IFRAMES — sink/relay API (#76/H3a):
//
// `applyPreviewVars` / `clearPreviewVars` let a caller push overrides directly
// to every iframe WITHOUT routing through the host <html>. The current
// overrides are kept in `previewOverrides` (the single source of truth), and
// that map is REPLAYED to any iframe once it signals `onIframeReady` — so a
// late-mounted or re-mounted iframe still receives the active tweaks.
//
// The legacy doc→preview MIRROR (MutationObserver on host <html>) was retired
// in #77/H3b. The preview now relies solely on this sink API for token tweaks
// and its own iframe stylesheet for base target tokens.

import {
  sendApplyCssVars,
  sendClearCssVars,
  onIframeReady,
  type CssVarPair,
} from "./iframe-css-vars-bridge.js";
import type { ExternalRuntimeIdentity } from "../preview/external-runtime.js";

const registered = new Set<HTMLIFrameElement>();
const readyTeardowns = new Map<HTMLIFrameElement, () => void>();
const strictFrames = new Map<HTMLIFrameElement, { identity: () => ExternalRuntimeIdentity | null; key: string; sequence: number }>();
const sentNames = new Map<HTMLIFrameElement, Set<string>>();

function bridgeFields(iframe: HTMLIFrameElement): { identity: ExternalRuntimeIdentity; sequence: number } | undefined | null {
  const state = strictFrames.get(iframe);
  if (!state) return undefined;
  const identity = state.identity();
  if (!identity) return null;
  const key = JSON.stringify(identity);
  if (state.key !== key) { state.key = key; state.sequence = -1; }
  return { identity, sequence: ++state.sequence };
}

/**
 * Current preview overrides pushed via the sink API (`applyPreviewVars` /
 * `clearPreviewVars`), keyed by custom-property name. This is the single
 * source of truth for "what overrides are currently active" and is replayed to
 * each iframe on `onIframeReady`.
 */
const previewOverrides = new Map<string, string>();

/** Snapshot the current sink overrides as bridge `[name, value]` pairs. */
function overridePairs(): CssVarPair[] {
  return [...previewOverrides].map(([name, value]) => [name, value] as const);
}

/**
 * Replay the current sink overrides onto one iframe. Called on `onIframeReady`
 * so a late-mounted or re-mounted iframe receives the active tweaks once its
 * receiver is installed.
 */
export function replayPreviewVars(iframe: HTMLIFrameElement): void {
  const pairs = overridePairs();
  const fields = bridgeFields(iframe);
  if (fields === null) return;
  const previous = sentNames.get(iframe) ?? new Set<string>();
  const stale = [...previous].filter((name) => !previewOverrides.has(name));
  if (stale.length) sendClearCssVars(iframe, stale, fields);
  if (pairs.length > 0) sendApplyCssVars(iframe, pairs, stale.length ? bridgeFields(iframe) ?? undefined : fields);
  sentNames.set(iframe, new Set(previewOverrides.keys()));
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
  for (const iframe of registered) {
    const fields = bridgeFields(iframe);
    if (fields !== null) {
      sendApplyCssVars(iframe, pairs, fields);
      const names = sentNames.get(iframe) ?? new Set<string>();
      for (const [name] of pairs) names.add(name);
      sentNames.set(iframe, names);
    }
  }
}

/**
 * Remove overrides from every registered preview iframe (sink/relay API).
 * Deletes each name from the current-override map so it is no longer replayed.
 */
export function clearPreviewVars(names: ReadonlyArray<string>): void {
  if (names.length === 0) return;
  for (const name of names) previewOverrides.delete(name);
  for (const iframe of registered) {
    const fields = bridgeFields(iframe);
    if (fields !== null) {
      sendClearCssVars(iframe, names, fields);
      for (const name of names) sentNames.get(iframe)?.delete(name);
    }
  }
}

/** Register a preview iframe so future token tweaks are pushed to it. Idempotent. */
export function registerPreviewIframe(iframe: HTMLIFrameElement, options: { identity?: () => ExternalRuntimeIdentity | null } = {}): void {
  if (registered.has(iframe)) return;
  registered.add(iframe);
  if (options.identity) {
    strictFrames.set(iframe, { identity: options.identity, key: "", sequence: -1 });
    return; // Strict replay is gated by VariantFrame's accepted sg:ready.
  }

  // On ready, replay the current sink overrides. Replaying on ready (not merely
  // on DOM registration) is what lets a late-mounted iframe pick up tweaks that
  // were applied before it booted.
  const teardown = onIframeReady(iframe.contentWindow, () => {
    replayPreviewVars(iframe);
  });
  readyTeardowns.set(iframe, teardown);
  // Also attempt an immediate replay (covers already-loaded iframes).
  replayPreviewVars(iframe);
}

/** Stop pushing token tweaks to an iframe (on unmount). Idempotent. */
export function unregisterPreviewIframe(iframe: HTMLIFrameElement): void {
  registered.delete(iframe);
  strictFrames.delete(iframe);
  sentNames.delete(iframe);
  const teardown = readyTeardowns.get(iframe);
  if (teardown) {
    teardown();
    readyTeardowns.delete(iframe);
  }
}
