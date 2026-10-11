// Explicitly created browser runtime; importing this public leaf is SSR-safe.
import {
  EXTERNAL_RUNTIME_VERSION, MSG_RESET_FIXTURE, MSG_RUNTIME_ERROR,
  isExternalRuntimeMessageEvent, isNewExternalRuntimeSequence, isSerializableProps,
  matchesExternalRuntimeIdentity,
  type ExternalFixtureIdentity, type ExternalFixtureInstance, type ExternalFixtureMount,
  type ExternalRuntimeError, type ExternalRuntimeIdentity, type ExternalPreviewMessage,
  type SerializableProps,
} from "./external-runtime.js";
import { MSG_HEIGHT, MSG_READY, MSG_REQUEST_READY, MSG_SET_THEME, MSG_UPDATE_PROPS, PROTOCOL_VERSION, type PreviewTheme } from "./messages.js";
import { installIframeReceiver } from "../token-tweak/iframe-css-vars-bridge.js";

export interface ExternalPreviewRuntimeOptions {
  target?: Window;
  /** Defaults to the document's slug/variant query parameters. */
  identity?: ExternalFixtureIdentity;
  initialProps?: SerializableProps;
  mount: ExternalFixtureMount;
  fullReset?: boolean;
  onTheme?(theme: PreviewTheme): void | Promise<void>;
  measureHeight?(): number;
  /** Background/final cleanup failures; defaults to console.error. */
  onCleanupError?(error: ExternalRuntimeError): void;
}

export interface ExternalRuntimeSnapshot {
  identity: ExternalRuntimeIdentity;
  ready: boolean;
  error: ExternalRuntimeError | null;
}

export interface ExternalPreviewRuntime {
  getSnapshot(): ExternalRuntimeSnapshot;
  /** Await the committed current fixture, pending updates, and its stability barrier. */
  whenStable(): Promise<ExternalRuntimeIdentity>;
  reportError(error: ExternalRuntimeError): void;
  reportHeight(): void;
  dispose(): Promise<void>;
}

/** Throw from a host loader to distinguish a missing fixture from a failed import. */
export class ExternalPreviewError extends Error {
  constructor(public readonly code: ExternalRuntimeError["code"], message: string, public readonly recoverable = true) {
    super(message);
    this.name = "ExternalPreviewError";
  }
}

function runtimeError(error: unknown, fallback: ExternalRuntimeError["code"]): ExternalRuntimeError {
  return {
    code: error instanceof ExternalPreviewError ? error.code : fallback,
    message: error instanceof Error ? error.message || error.name : String(error),
    recoverable: error instanceof ExternalPreviewError ? error.recoverable : true,
  };
}

export function createExternalPreviewRuntime(options: ExternalPreviewRuntimeOptions): ExternalPreviewRuntime {
  const target = options.target ?? window;
  const params = new URLSearchParams(target.location.search);
  const fixture = options.identity ?? { slug: params.get("slug") ?? "", variant: params.get("variant") ?? "" };
  const documentId = target.crypto.randomUUID();
  let identity: ExternalRuntimeIdentity = { ...fixture, documentId, sessionId: `standalone-${documentId}`, generation: 0 };
  let props: SerializableProps = options.initialProps ?? {};
  if (!isSerializableProps(props)) throw new TypeError("External runtime initialProps must be serializable props");
  let propsRevision = 0;
  let ready = false;
  let error: ExternalRuntimeError | null = null;
  let errorRevision = 0;
  let errorNode: HTMLElement | null = null;
  let disposed = false;
  let epoch = 0;
  let outgoing = -1;
  let incoming = -1;
  let instance: ExternalFixtureInstance | null = null;
  let abort = new AbortController();
  let operations = Promise.resolve();
  let mounting = Promise.resolve();
  let pendingMountOwner: number | null = null;
  let disposeResult: Promise<void> | undefined;
  let restoreListener: ((event: PageTransitionEvent) => void) | null = null;
  const retiredSessions = new Set<string>();
  const fullReset = options.fullReset === true;

  const current = (owner: number) => !disposed && owner === epoch;
  function post(message: Omit<ExternalPreviewMessage, keyof ExternalRuntimeIdentity | "v" | "runtimeVersion" | "sequence"> & Record<string, unknown>): void {
    if (disposed || target.parent === target || target.location.origin === "null") return;
    target.parent.postMessage({ ...message, ...identity, v: PROTOCOL_VERSION, runtimeVersion: EXTERNAL_RUNTIME_VERSION, sequence: ++outgoing }, target.location.origin);
  }
  function clearError(): void {
    error = null;
    errorNode?.remove();
    errorNode = null;
  }
  function reportError(value: ExternalRuntimeError): void {
    if (disposed) return;
    errorRevision++;
    error = { ...value };
    ready = false;
    if (!errorNode) {
      errorNode = target.document.createElement("pre");
      errorNode.setAttribute("role", "alert");
      errorNode.setAttribute("data-sg-runtime-error", "");
      target.document.body.appendChild(errorNode);
    }
    errorNode.textContent = `Preview failed: ${value.message}`;
    post({ type: MSG_RUNTIME_ERROR, error });
  }
  function reportHeight(): void {
    if (!ready || disposed) return;
    try {
      const height = options.measureHeight?.() ?? Math.ceil(target.document.body.getBoundingClientRect().bottom + target.scrollY);
      if (Number.isFinite(height) && height >= 0) post({ type: MSG_HEIGHT, height });
    } catch (failure) { reportError(runtimeError(failure, "render")); }
  }
  function announce(): void {
    if (error) post({ type: MSG_RUNTIME_ERROR, error });
    else if (ready) {
      post({ type: MSG_READY, capabilities: { fullReset } });
      reportHeight();
    }
  }
  async function disposeInstance(value: ExternalFixtureInstance, owner: number, propagate = false): Promise<void> {
    try { await value.dispose(); }
    catch (failure) {
      const diagnostic = runtimeError(failure, "render");
      if (current(owner)) reportError(diagnostic);
      try {
        if (options.onCleanupError) options.onCleanupError(diagnostic);
        else console.error("External fixture cleanup failed:", failure);
      } catch (callbackFailure) { console.error("External fixture cleanup reporter failed:", callbackFailure); }
      if (propagate) throw failure;
    }
  }
  function queue(work: () => void | Promise<void>, owner = epoch): void {
    operations = operations.then(async () => {
      if (!current(owner)) return;
      try { await work(); }
      catch (failure) { if (current(owner)) reportError(runtimeError(failure, "render")); }
    });
  }
  function mount(): void {
    const owner = epoch;
    pendingMountOwner = owner;
    const revision = propsRevision;
    const initial = props;
    const signal = abort.signal;
    const cancelled = Symbol("cancelled mount");
    mounting = Promise.resolve().then(() => {
      if (!current(owner)) return cancelled;
      return options.mount({
        identity: { ...identity }, props: initial, signal,
        reportError: (failure) => { if (current(owner)) reportError(failure); },
      });
    }).then(async (mounted) => {
      if (mounted === cancelled) return;
      if (!mounted || typeof mounted.update !== "function" || typeof mounted.dispose !== "function" ||
        (mounted.whenStable !== undefined && typeof mounted.whenStable !== "function")) {
        throw new ExternalPreviewError("render", "External fixture mount must return an instance with update() and dispose() methods");
      }
      if (!current(owner)) { await disposeInstance(mounted, owner); return; }
      // Catch-up updates share the same queue as ordinary updates/disposal.
      // Keep the new instance private until catch-up finishes, so reset cannot
      // dispose it while that asynchronous update is still using its resources.
      operations = operations.then(async () => {
        let applied = revision;
        try {
          while (current(owner) && applied !== propsRevision) {
            applied = propsRevision;
            await mounted.update(props);
          }
          if (!current(owner)) { await disposeInstance(mounted, owner); return; }
          instance = mounted;
          if (!error) { ready = true; announce(); }
        } catch (failure) {
          await disposeInstance(mounted, owner);
          if (current(owner)) reportError(runtimeError(failure, "render"));
        }
      });
      await operations;
    }).catch((failure) => { if (current(owner)) reportError(runtimeError(failure, "import")); }).finally(() => {
      if (pendingMountOwner === owner) pendingMountOwner = null;
      // Props received during a failed attempt also get one new attempt. A
      // failure with unchanged props never retries itself indefinitely.
      if (current(owner) && !instance && error && propsRevision !== revision) retryFailedMount();
    });
  }
  function retryFailedMount(): void {
    if (pendingMountOwner !== null || instance || !error) return;
    abort.abort();
    abort = new AbortController();
    epoch++;
    ready = false;
    clearError();
    mount();
  }
  function reset(nextGeneration: number): void {
    const old = instance;
    instance = null;
    abort.abort();
    abort = new AbortController();
    const owner = ++epoch;
    identity = { ...identity, generation: nextGeneration };
    incoming = -1;
    outgoing = -1;
    ready = false;
    clearError();
    // In-flight updates finish/cancel before disposing their resources. A
    // pending import does not block reset; its eventual result is disposed.
    operations = operations.then(async () => {
      if (old) await disposeInstance(old, owner);
      if (current(owner)) mount();
    });
  }
  function receive(event: MessageEvent): void {
    if (!isExternalRuntimeMessageEvent(event, { origin: target.location.origin, source: target.parent })) return;
    const message = event.data;
    if (message.slug !== fixture.slug || message.variant !== fixture.variant) return;
    if (message.type === MSG_REQUEST_READY) {
      if (retiredSessions.has(message.sessionId)) return;
      if (message.sessionId !== identity.sessionId) {
        retiredSessions.add(identity.sessionId);
        identity = { ...identity, sessionId: message.sessionId };
        incoming = -1;
        outgoing = -1;
      }
      announce();
      return;
    }
    if (!matchesExternalRuntimeIdentity(message, identity) || !isNewExternalRuntimeSequence(message.sequence, incoming)) return;
    if (message.type !== MSG_UPDATE_PROPS && message.type !== MSG_SET_THEME && message.type !== MSG_RESET_FIXTURE) return;
    if (message.type === MSG_RESET_FIXTURE && !fullReset) return;
    incoming = message.sequence;
    if (message.type === MSG_UPDATE_PROPS) {
      props = message.props;
      propsRevision++;
      const mounted = instance;
      if (mounted) {
        const snapshot = props;
        const owner = epoch;
        queue(async () => {
          const previousErrorRevision = errorRevision;
          await mounted.update(snapshot);
          // A renderer may report an error through its mount context without
          // rejecting update(). Only recover an error that predates this update.
          if (!current(owner) || previousErrorRevision !== errorRevision) return;
          const recovering = !!error;
          clearError();
          ready = true;
          if (recovering) announce();
          else reportHeight();
        }, owner);
      } else retryFailedMount();
    } else if (message.type === MSG_SET_THEME) {
      target.document.documentElement.dataset.theme = message.theme;
      queue(() => options.onTheme?.(message.theme));
    } else reset(message.nextGeneration);
  }
  target.addEventListener("message", receive);
  const removeTokens = installIframeReceiver(target, { identity: () => identity });
  const observer = new (target as Window & typeof globalThis).ResizeObserver(reportHeight);
  observer.observe(target.document.body);
  // Disposal reports its diagnostic; consume the rejection for this event path.
  const pagehide = (event: PageTransitionEvent) => {
    void dispose().catch(() => {});
    if (event.persisted) {
      // BFCache can restore this disposed Document instead of booting the entry.
      // Reload once on restoration so it receives fresh resources and identity.
      restoreListener = (shown) => {
        if (restoreListener) target.removeEventListener("pageshow", restoreListener);
        restoreListener = null;
        if (shown.persisted) target.location.reload();
      };
      target.addEventListener("pageshow", restoreListener);
    }
  };
  target.addEventListener("pagehide", pagehide);
  mount();

  function dispose(): Promise<void> {
    if (restoreListener) target.removeEventListener("pageshow", restoreListener);
    restoreListener = null;
    if (disposeResult) return disposeResult;
    disposed = true;
    epoch++;
    abort.abort();
    target.removeEventListener("message", receive);
    target.removeEventListener("pagehide", pagehide);
    observer.disconnect();
    removeTokens();
    errorNode?.remove();
    const old = instance;
    instance = null;
    ready = false;
    disposeResult = operations.then(async () => { if (old) await disposeInstance(old, epoch, true); });
    return disposeResult;
  }
  return {
    getSnapshot: () => ({ identity: { ...identity }, ready, error: error ? { ...error } : null }),
    async whenStable() {
      const owner = epoch;
      const revision = propsRevision;
      await operations;
      await mounting;
      await operations;
      const mounted = instance;
      if (!current(owner) || !mounted || !ready || error) throw new Error(error?.message ?? "External fixture is not ready");
      await mounted.whenStable?.();
      if (!current(owner) || !ready || error || revision !== propsRevision) throw new Error("External fixture changed while waiting for stability");
      return { ...identity };
    },
    reportError, reportHeight, dispose,
  };
}
