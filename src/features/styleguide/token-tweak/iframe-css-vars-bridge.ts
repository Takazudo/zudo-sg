// postMessage bridge for pushing design-token CSS custom properties from the
// styleguide catalog page into an isolated `/components/preview` iframe.
//
// This used to be a reusable utility zudo-doc itself shipped
// (`@takazudo/zudo-doc/theme`'s `sendApplyCssVars` / `sendClearCssVars` /
// `installIframeReceiver` / `onIframeReady`), which this project's own
// preview-iframe token-tweak feature (#76/H3a) imported as a convenience.
// zudo-doc 4.0 removed that bridge as a "repository-owned" implementation
// detail (zudolab/zudo-doc#2761) — it was never meant as public API. Since
// this project is the only consumer, the bridge (envelope + sender +
// receiver) is now owned here instead, ported as-is from the pre-4.0
// implementation so the wire contract and behavior are unchanged.
//
// Two directions:
//   parent → iframe : apply-css-vars / clear-css-vars (see preview-iframe-registry.ts)
//   iframe → parent : ready                            (`onIframeReady` below)

const BRIDGE_SOURCE = "zudo-sg-token-tweak-bridge" as const;

export type CssVarPair = readonly [name: string, value: string];

interface ApplyCssVarsMessage {
  source: typeof BRIDGE_SOURCE;
  type: "apply-css-vars";
  vars: ReadonlyArray<CssVarPair>;
}

interface ClearCssVarsMessage {
  source: typeof BRIDGE_SOURCE;
  type: "clear-css-vars";
  names: ReadonlyArray<string>;
}

interface ReadyMessage {
  source: typeof BRIDGE_SOURCE;
  type: "ready";
}

type BridgeMessage = ApplyCssVarsMessage | ClearCssVarsMessage | ReadyMessage;

/** Type guard. Accepts any postMessage payload and confirms it is a bridge envelope. */
function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as { source?: unknown; type?: unknown };
  return v.source === BRIDGE_SOURCE && typeof v.type === "string";
}

/** Send `apply-css-vars` to the iframe. No-op when the iframe has not loaded. */
export function sendApplyCssVars(
  iframe: HTMLIFrameElement | null,
  vars: ReadonlyArray<CssVarPair>,
): void {
  const win = iframe?.contentWindow;
  if (!win) return;
  const message: ApplyCssVarsMessage = { source: BRIDGE_SOURCE, type: "apply-css-vars", vars };
  win.postMessage(message, window.location.origin);
}

/** Send `clear-css-vars` to the iframe so it removes inline overrides. */
export function sendClearCssVars(
  iframe: HTMLIFrameElement | null,
  names: ReadonlyArray<string>,
): void {
  const win = iframe?.contentWindow;
  if (!win) return;
  const message: ClearCssVarsMessage = { source: BRIDGE_SOURCE, type: "clear-css-vars", names };
  win.postMessage(message, window.location.origin);
}

/**
 * Install a message listener inside the preview iframe document that applies
 * any incoming CSS-var batches onto `documentElement.style`. Returns a
 * teardown function. Intended to be called once at iframe boot.
 */
export function installIframeReceiver(target: Window = window): () => void {
  function handler(event: MessageEvent): void {
    if (event.origin !== target.location.origin) return;
    const data = event.data;
    if (!isBridgeMessage(data)) return;
    if (data.type === "apply-css-vars") {
      const root = target.document.documentElement;
      for (const [name, value] of data.vars) root.style.setProperty(name, value);
      return;
    }
    if (data.type === "clear-css-vars") {
      const root = target.document.documentElement;
      for (const name of data.names) root.style.removeProperty(name);
      return;
    }
  }
  target.addEventListener("message", handler);
  const parent = target.parent;
  if (parent && parent !== target) {
    const ready: ReadyMessage = { source: BRIDGE_SOURCE, type: "ready" };
    parent.postMessage(ready, target.location.origin);
  }
  return () => target.removeEventListener("message", handler);
}

/**
 * Install a `ready` listener on the panel side so callers can defer the
 * initial CSS-var sync until the iframe document has booted.
 */
export function onIframeReady(expectedSource: Window | null, callback: () => void): () => void {
  function handler(event: MessageEvent): void {
    if (event.origin !== window.location.origin) return;
    if (expectedSource && event.source !== expectedSource) return;
    if (!isBridgeMessage(event.data)) return;
    if (event.data.type === "ready") callback();
  }
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
