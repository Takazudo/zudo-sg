// postMessage bridge for pushing design-token CSS custom properties from the
// styleguide catalog page into an isolated `/components/preview` iframe.
//
// This used to be a reusable utility zudo-doc itself shipped
// (`@takazudo/zudo-doc/theme`'s `sendApplyCssVars` / `sendClearCssVars` /
// `installIframeReceiver` / `onIframeReady`), which this project's own
// preview-iframe token-tweak feature (#76/H3a) imported as a convenience.
// zudo-doc removed that bridge as a "repository-owned" implementation
// detail (zudolab/zudo-doc#2761) — it was never meant as public API. Since
// this project is the only consumer, the bridge (envelope + sender +
// receiver) is owned by the @takazudo/zudo-sg engine, ported from the pre-4.0
// implementation so the wire contract is unchanged.
//
// Two directions:
//   parent → iframe : apply-css-vars / clear-css-vars (see preview-iframe-registry.ts)
//   iframe → parent : ready                            (`onIframeReady` below)

import { isExternalRuntimeIdentity, isNewExternalRuntimeSequence, isSerializableProps, matchesExternalRuntimeIdentity, type ExternalRuntimeIdentity } from "../preview/external-runtime.js";

interface StrictBridgeFields {
  identity?: ExternalRuntimeIdentity;
  sequence?: number;
}

/** Envelope `source` tag. Part of the wire contract (e2e/preview-token-panel.spec.ts mirrors it). */
export const BRIDGE_SOURCE = "zudo-sg-token-tweak-bridge" as const;

export type CssVarPair = readonly [name: string, value: string];

export interface ApplyCssVarsMessage extends StrictBridgeFields {
  source: typeof BRIDGE_SOURCE;
  type: "apply-css-vars";
  vars: ReadonlyArray<CssVarPair>;
}

export interface ClearCssVarsMessage extends StrictBridgeFields {
  source: typeof BRIDGE_SOURCE;
  type: "clear-css-vars";
  names: ReadonlyArray<string>;
}

export interface ReadyMessage extends StrictBridgeFields {
  source: typeof BRIDGE_SOURCE;
  type: "ready";
}

export type BridgeMessage = ApplyCssVarsMessage | ClearCssVarsMessage | ReadyMessage;

/** Type guard. Accepts any postMessage payload and confirms it is a bridge envelope. */
export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!isSerializableProps(value)) return false;
  const v = value as { source?: unknown; type?: unknown; vars?: unknown; names?: unknown };
  if (v.source !== BRIDGE_SOURCE) return false;
  const strict = value as StrictBridgeFields;
  if ((strict.identity !== undefined || strict.sequence !== undefined) &&
    (!isExternalRuntimeIdentity(strict.identity) || !isNewExternalRuntimeSequence(strict.sequence, -1))) return false;
  switch (v.type) {
    case "apply-css-vars":
      return Array.isArray(v.vars) && v.vars.every(isCssVarPair);
    case "clear-css-vars":
      return Array.isArray(v.names) && v.names.every(isBridgeCssProperty);
    case "ready":
      return true;
    default:
      return false;
  }
}

function isCssVarPair(value: unknown): value is CssVarPair {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isBridgeCssProperty(value[0]) &&
    typeof value[1] === "string"
  );
}

function isBridgeCssProperty(value: unknown): value is string {
  // zdtp's sink owns color-scheme alongside custom properties so light-dark()
  // values resolve correctly. Its Reset clears these in one mixed batch.
  return value === "color-scheme" || (typeof value === "string" && /^--(?:[A-Za-z0-9_-]|[^\u0000-\u007f])+$/u.test(value));
}

/** Send `apply-css-vars` to the iframe. No-op when the iframe has not loaded. */
export function sendApplyCssVars(
  iframe: HTMLIFrameElement | null,
  vars: ReadonlyArray<CssVarPair>,
  strict?: Required<StrictBridgeFields>,
): void {
  const win = iframe?.contentWindow;
  if (!win || window.location.origin === "null") return;
  const message: ApplyCssVarsMessage = { source: BRIDGE_SOURCE, type: "apply-css-vars", vars, ...strict };
  win.postMessage(message, window.location.origin);
}

/** Send `clear-css-vars` to the iframe so it removes inline overrides. */
export function sendClearCssVars(
  iframe: HTMLIFrameElement | null,
  names: ReadonlyArray<string>,
  strict?: Required<StrictBridgeFields>,
): void {
  const win = iframe?.contentWindow;
  if (!win || window.location.origin === "null") return;
  const message: ClearCssVarsMessage = { source: BRIDGE_SOURCE, type: "clear-css-vars", names, ...strict };
  win.postMessage(message, window.location.origin);
}

/**
 * Install a message listener inside the preview iframe document that applies
 * any incoming CSS-var batches onto `documentElement.style`. Returns a
 * teardown function. Intended to be called once at iframe boot.
 */
export function installIframeReceiver(target: Window = window, options: { identity?: () => ExternalRuntimeIdentity | null } = {}): () => void {
  let lastSequence = -1;
  let acceptedIdentity = "";
  const applied = new Set<string>();
  function handler(event: MessageEvent): void {
    if (target.location.origin === "null" || event.origin !== target.location.origin || event.source !== target.parent) return;
    const data = event.data;
    if (!isBridgeMessage(data)) return;
    if (data.type === "ready") return;
    if (options.identity) {
      const identity = options.identity();
      if (!identity || !data.identity || !matchesExternalRuntimeIdentity(data.identity, identity)) return;
      const key = JSON.stringify(identity);
      const previous = key === acceptedIdentity ? lastSequence : -1;
      if (!isNewExternalRuntimeSequence(data.sequence, previous)) return;
      acceptedIdentity = key;
      lastSequence = data.sequence;
    }
    if (data.type === "apply-css-vars") {
      const root = target.document.documentElement;
      for (const [name, value] of data.vars) { root.style.setProperty(name, value); applied.add(name); }
      return;
    }
    if (data.type === "clear-css-vars") {
      const root = target.document.documentElement;
      for (const name of data.names) { root.style.removeProperty(name); applied.delete(name); }
      return;
    }
  }
  target.addEventListener("message", handler);
  const parent = target.parent;
  if (!options.identity && parent && parent !== target && target.location.origin !== "null") {
    const ready: ReadyMessage = { source: BRIDGE_SOURCE, type: "ready" };
    parent.postMessage(ready, target.location.origin);
  }
  return () => {
    target.removeEventListener("message", handler);
    for (const name of applied) target.document.documentElement.style.removeProperty(name);
    applied.clear();
  };
}

/**
 * Install a `ready` listener on the panel side so callers can defer the
 * initial CSS-var sync until the iframe document has booted.
 */
export function onIframeReady(expectedSource: Window | null, callback: () => void): () => void {
  function handler(event: MessageEvent): void {
    if (window.location.origin === "null" || event.origin !== window.location.origin) return;
    if (!expectedSource || event.source !== expectedSource) return;
    if (!isBridgeMessage(event.data)) return;
    if (event.data.type === "ready") callback();
  }
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
