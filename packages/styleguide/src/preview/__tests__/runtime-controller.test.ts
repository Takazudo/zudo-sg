// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExternalPreviewRuntime, ExternalPreviewError, type ExternalPreviewRuntime, type ExternalPreviewRuntimeOptions } from "../runtime-controller.js";
import type { ExternalFixtureInstance, ExternalFixtureMount, ExternalFixtureMountContext } from "../external-runtime.js";

const runtimes: ExternalPreviewRuntime[] = [];
function make(mount: ExternalFixtureMount = vi.fn((): ExternalFixtureInstance => ({ update: vi.fn(), dispose: vi.fn() })), options: Partial<ExternalPreviewRuntimeOptions> = {}) {
  const runtime = createExternalPreviewRuntime({ target: window, identity: { slug: "counter", variant: "Default" }, mount, fullReset: true, ...options });
  runtimes.push(runtime);
  return runtime;
}
function send(runtime: ExternalPreviewRuntime, type: string, extra: Record<string, unknown> = {}, sequence = 0) {
  const data = { v: 1, runtimeVersion: 1, ...runtime.getSnapshot().identity, sequence, type, ...extra };
  window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: window.parent, data }));
  return data;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
  document.body.innerHTML = "";
});

describe("external preview runtime controller", () => {
  it("mounts once, applies props on the existing instance and full-resets only explicitly", async () => {
    const instances: ExternalFixtureInstance[] = [];
    const props: unknown[] = [];
    const mount = vi.fn((context: ExternalFixtureMountContext) => {
      props.push(context.props);
      const instance = { update: vi.fn(), dispose: vi.fn(), whenStable: vi.fn(async () => {}) };
      instances.push(instance);
      return instance;
    });
    const runtime = make(mount);
    await runtime.whenStable();
    send(runtime, "sg:updateProps", { props: { label: "edited" } });
    await runtime.whenStable();
    expect(instances[0]?.update).toHaveBeenCalledWith({ label: "edited" });
    send(runtime, "sg:updateProps", { props: { label: "default" } }, 1);
    await runtime.whenStable();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(instances[0]?.dispose).not.toHaveBeenCalled();
    const reset = send(runtime, "sg:resetFixture", { nextGeneration: 1 }, 2);
    await runtime.whenStable();
    expect(instances[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(props[1]).toEqual({ label: "default" });
    window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: window, data: reset }));
    await runtime.whenStable();
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it("rejects stale/wrong-window traffic and malformed high sequence without advancing state", async () => {
    const update = vi.fn();
    const runtime = make(vi.fn(() => ({ update, dispose: vi.fn() })));
    await runtime.whenStable();
    const base = { v: 1, runtimeVersion: 1, ...runtime.getSnapshot().identity, type: "sg:updateProps", sequence: 100, props: { value: 1 } };
    for (const data of [{ ...base, documentId: "stale" }, { ...base, props: { value: Infinity } }, { ...base, type: "sg:ready", capabilities: { fullReset: true } }]) {
      window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: window, data }));
    }
    window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: null, data: base }));
    send(runtime, "sg:updateProps", { props: { value: 2 } }, 0);
    await runtime.whenStable();
    expect(update).toHaveBeenCalledExactlyOnceWith({ value: 2 });
  });

  it("shows initial import/unknown-fixture errors without claiming ready and recovers by reset", async () => {
    const mount = vi.fn().mockRejectedValueOnce(new ExternalPreviewError("unknown-fixture", "No such fixture"))
      .mockResolvedValue({ update: vi.fn(), dispose: vi.fn() });
    const runtime = make(mount);
    await expect(runtime.whenStable()).rejects.toThrow("No such fixture");
    expect(runtime.getSnapshot()).toMatchObject({ ready: false, error: { code: "unknown-fixture" } });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("No such fixture");
    send(runtime, "sg:resetFixture", { nextGeneration: 1 });
    await runtime.whenStable();
    expect(runtime.getSnapshot()).toMatchObject({ ready: true, error: null });
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("handles rejected updates and disposal without unhandled promises", async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error("render failed")).mockResolvedValue(undefined);
    const dispose = vi.fn().mockRejectedValue(new Error("cleanup failed"));
    const onCleanupError = vi.fn();
    const runtime = make(vi.fn(() => ({ update, dispose })), { onCleanupError });
    await runtime.whenStable();
    send(runtime, "sg:updateProps", { props: { a: 1 } });
    await expect(runtime.whenStable()).rejects.toThrow("render failed");
    expect(runtime.getSnapshot().error?.code).toBe("render");
    send(runtime, "sg:updateProps", { props: { a: 2 } }, 1);
    await runtime.whenStable();
    expect(runtime.getSnapshot().error).toBeNull();
    await expect(runtime.dispose()).rejects.toThrow("cleanup failed");
    expect(onCleanupError).toHaveBeenCalledExactlyOnceWith({ code: "render", message: "cleanup failed", recoverable: true });
    expect(dispose).toHaveBeenCalledTimes(1);
    runtimes.splice(runtimes.indexOf(runtime), 1);
  });

  it.each(["render", "import"] as const)("retries a failed initial %s on corrected props without overlapping mounts or stale callbacks", async (code) => {
    let failedContext!: ExternalFixtureMountContext;
    const pending = deferred<ExternalFixtureInstance>();
    const update = vi.fn();
    const mount = vi.fn().mockImplementationOnce((context: ExternalFixtureMountContext) => {
      failedContext = context;
      throw new ExternalPreviewError(code, "Initial attempt failed");
    }).mockImplementationOnce(() => pending.promise);
    const runtime = make(mount);
    await expect(runtime.whenStable()).rejects.toThrow("Initial attempt failed");
    const identity = runtime.getSnapshot().identity;
    expect(mount).toHaveBeenCalledTimes(1);
    send(runtime, "sg:updateProps", { props: { valid: true } });
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2));
    expect(mount.mock.calls[1]?.[0].props).toEqual({ valid: true });
    expect(failedContext.signal.aborted).toBe(true);
    send(runtime, "sg:updateProps", { props: { valid: "latest" } }, 1);
    failedContext.reportError({ code: "render", message: "stale attempt", recoverable: true });
    expect(runtime.getSnapshot().error).toBeNull();
    expect(mount).toHaveBeenCalledTimes(2);
    pending.resolve({ update, dispose: vi.fn() });
    await runtime.whenStable();
    expect(update).toHaveBeenCalledExactlyOnceWith({ valid: "latest" });
    expect(runtime.getSnapshot()).toMatchObject({ identity, ready: true, error: null });
    failedContext.reportError({ code: "render", message: "still stale", recoverable: true });
    expect(runtime.getSnapshot().error).toBeNull();
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it.each([null, undefined, {}, { update() {} }])("reports an invalid mount handle %j", async (handle) => {
    const runtime = make(vi.fn(() => handle) as unknown as ExternalFixtureMount);
    await expect(runtime.whenStable()).rejects.toThrow("must return an instance");
    expect(runtime.getSnapshot().error?.code).toBe("render");
  });

  it.each([false, true])("preserves callback-reported update errors (async: %s) and recovers on a later successful update", async (asynchronous) => {
    let context!: ExternalFixtureMountContext;
    const pending = deferred<void>();
    const update = vi.fn().mockImplementationOnce(() => {
      context.reportError({ code: "render", message: "actual failed render", recoverable: true });
      return asynchronous ? pending.promise : undefined;
    }).mockResolvedValue(undefined);
    const runtime = make((value) => {
      context = value;
      return { update, dispose: vi.fn() };
    });
    await runtime.whenStable();
    send(runtime, "sg:updateProps", { props: { fail: true } });
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(runtime.getSnapshot()).toMatchObject({ ready: false, error: { message: "actual failed render" } });
    pending.resolve();
    await expect(runtime.whenStable()).rejects.toThrow("actual failed render");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("actual failed render");
    send(runtime, "sg:updateProps", { props: { fail: false } }, 1);
    await runtime.whenStable();
    expect(runtime.getSnapshot()).toMatchObject({ ready: true, error: null });
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("reports late cancelled mount cleanup failures without replacing the active fixture state", async () => {
    const pending = deferred<ExternalFixtureInstance>();
    const onCleanupError = vi.fn();
    const runtime = make(vi.fn(() => pending.promise), { onCleanupError });
    await Promise.resolve();
    await runtime.dispose();
    pending.resolve({ update: vi.fn(), dispose: vi.fn().mockRejectedValue(new Error("late cleanup failed")) });
    await vi.waitFor(() => expect(onCleanupError).toHaveBeenCalledWith({ code: "render", message: "late cleanup failed", recoverable: true }));
    expect(runtime.getSnapshot()).toMatchObject({ ready: false, error: null });
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("does not start a mount after immediate disposal", async () => {
    const mount = vi.fn(() => ({ update: vi.fn(), dispose: vi.fn() }));
    const runtime = make(mount);
    await runtime.dispose();
    await expect(runtime.whenStable()).rejects.toThrow();
    expect(mount).not.toHaveBeenCalled();
  });

  it("reloads a disposed BFCache document once on restoration and removes that listener on manual disposal", async () => {
    // Happy DOM exposes PageTransitionEvent but omits its persisted property.
    const persistedEvent = (type: string) => {
      const event = new Event(type);
      Object.defineProperty(event, "persisted", { value: true });
      window.dispatchEvent(event);
    };
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    const dispose = vi.fn();
    const runtime = make(vi.fn(() => ({ update: vi.fn(), dispose })));
    await runtime.whenStable();
    persistedEvent("pagehide");
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    persistedEvent("pageshow");
    persistedEvent("pageshow");
    expect(reload).toHaveBeenCalledTimes(1);
    const second = make();
    await second.whenStable();
    persistedEvent("pagehide");
    await second.dispose();
    persistedEvent("pageshow");
    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockRestore();
  });

  it("disposes a late async mount instead of resurrecting a disposed runtime", async () => {
    const pending = deferred<ExternalFixtureInstance>();
    const mount = vi.fn(() => pending.promise);
    const runtime = make(mount);
    await Promise.resolve();
    await runtime.dispose();
    const instance = { update: vi.fn(), dispose: vi.fn() };
    pending.resolve(instance);
    await vi.waitFor(() => expect(instance.dispose).toHaveBeenCalledTimes(1));
    expect(runtime.getSnapshot().ready).toBe(false);
    expect(instance.update).not.toHaveBeenCalled();
  });

  it("waits for mount catch-up updates before disposal/reset and ignores stale error callbacks", async () => {
    const pending = deferred<ExternalFixtureInstance>();
    const updateDone = deferred<void>();
    const first = { update: vi.fn(() => updateDone.promise), dispose: vi.fn() };
    let context!: ExternalFixtureMountContext;
    const mount = vi.fn().mockImplementationOnce((value) => { context = value; return pending.promise; })
      .mockResolvedValue({ update: vi.fn(), dispose: vi.fn() });
    const runtime = make(mount);
    await Promise.resolve();
    send(runtime, "sg:updateProps", { props: { edited: true } });
    pending.resolve(first);
    await vi.waitFor(() => expect(first.update).toHaveBeenCalled());
    send(runtime, "sg:resetFixture", { nextGeneration: 1 }, 1);
    expect(context.signal.aborted).toBe(true);
    expect(first.dispose).not.toHaveBeenCalled();
    context.reportError({ code: "render", message: "stale error", recoverable: true });
    updateDone.resolve();
    await runtime.whenStable();
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot().error).toBeNull();
  });

  it("waits for the fixture stability barrier and rejects a changing capture", async () => {
    const stable = deferred<void>();
    const instance = { update: vi.fn(), dispose: vi.fn(), whenStable: vi.fn(() => stable.promise) };
    const runtime = make(vi.fn(() => instance));
    const capture = runtime.whenStable();
    await vi.waitFor(() => expect(instance.whenStable).toHaveBeenCalled());
    send(runtime, "sg:updateProps", { props: { changed: true } });
    stable.resolve();
    await expect(capture).rejects.toThrow(/changed/);
    expect((await runtime.whenStable()).documentId).toBe(runtime.getSnapshot().identity.documentId);
  });
});
