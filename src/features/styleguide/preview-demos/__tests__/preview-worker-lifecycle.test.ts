import { describe, expect, it, vi } from "vitest";
import { createPreviewWorkerLifecycle } from "../preview-worker-lifecycle";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function worker() {
  return { start: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
}

describe("contact preview worker lifetimes", () => {
  it("does not start after disposal during deferred imports", async () => {
    const activate = createPreviewWorkerLifecycle();
    const imports = deferred<ReturnType<typeof worker>>();
    const ready = vi.fn();
    const load = vi.fn(() => imports.promise);
    const dispose = activate(load, ready, vi.fn());
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    dispose();
    const stale = worker();
    imports.resolve(stale);
    const fresh = worker();
    const disposeFresh = activate(async () => fresh, ready, vi.fn());
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(stale.start).not.toHaveBeenCalled();
    expect(stale.stop).not.toHaveBeenCalled();
    disposeFresh();
    await vi.waitFor(() => expect(fresh.stop).toHaveBeenCalledOnce());
  });

  it("waits for late startup and asynchronous stop before starting a replacement", async () => {
    const activate = createPreviewWorkerLifecycle();
    const start = deferred();
    const stop = deferred();
    const old = worker();
    old.start.mockImplementation(() => start.promise);
    old.stop.mockImplementation(() => stop.promise);
    const oldReady = vi.fn();
    const dispose = activate(async () => old, oldReady, vi.fn());
    await vi.waitFor(() => expect(old.start).toHaveBeenCalledOnce());
    dispose();
    const next = worker();
    const nextReady = vi.fn();
    const disposeNext = activate(async () => next, nextReady, vi.fn());
    expect(old.stop).not.toHaveBeenCalled();
    expect(next.start).not.toHaveBeenCalled();
    start.resolve();
    await vi.waitFor(() => expect(old.stop).toHaveBeenCalledOnce());
    expect(oldReady).not.toHaveBeenCalled();
    expect(next.start).not.toHaveBeenCalled();
    stop.resolve();
    await vi.waitFor(() => expect(nextReady).toHaveBeenCalledOnce());
    expect(old.stop).toHaveBeenCalledOnce();
    disposeNext();
    await vi.waitFor(() => expect(next.stop).toHaveBeenCalledOnce());
  });

  it("reports rejected teardown and blocks a fresh worker instead of risking a stale client", async () => {
    const activate = createPreviewWorkerLifecycle();
    const stop = deferred();
    const old = worker();
    old.stop.mockImplementation(() => stop.promise);
    const report = vi.fn();
    const ready = vi.fn();
    const dispose = activate(async () => old, ready, vi.fn(), report);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    dispose();
    const loadNext = vi.fn(async () => worker());
    const failed = vi.fn();
    const disposeNext = activate(loadNext, vi.fn(), failed);
    stop.reject(new Error("teardown rejected"));
    await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("cleanup failed"),
      cause: expect.objectContaining({ message: "teardown rejected" }),
    }));
    expect(loadNext).not.toHaveBeenCalled();
    disposeNext();
  });

  it("cleans failed startup before permitting retry, without updating a disposed mount", async () => {
    const activate = createPreviewWorkerLifecycle();
    const start = deferred();
    const old = worker();
    old.start.mockImplementation(() => start.promise);
    const failed = vi.fn();
    const ready = vi.fn();
    const dispose = activate(async () => old, ready, failed);
    await vi.waitFor(() => expect(old.start).toHaveBeenCalledOnce());
    dispose();
    start.reject(new Error("start rejected"));
    const next = worker();
    const disposeNext = activate(async () => next, ready, failed);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(old.stop).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    disposeNext();
    await vi.waitFor(() => expect(next.stop).toHaveBeenCalledOnce());
  });
});
