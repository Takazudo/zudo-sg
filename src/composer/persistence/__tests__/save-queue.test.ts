import { describe, expect, it } from "vitest";
import {
  CompositionSaveQueueClosedError,
  CompositionSaveQueueIdentityError,
  createCompositionSaveQueue,
  createSampleDocument,
} from "../../index";
import type {
  CompositionRecord,
  CompositionRecordRef,
  CompositionSaveQueue,
  CompositionSaveSnapshot,
} from "../../index";

const ref = { providerId: "indexeddb", recordId: "composition-a" } as const;

function record(name: string, id = ref.recordId): CompositionRecord {
  const document = createSampleDocument();
  document.id = id;
  document.name = name;
  return {
    id,
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
    document,
  };
}

function controlled<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface WriteAttempt {
  snapshot: CompositionSaveSnapshot;
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

function queueHarness(): { queue: CompositionSaveQueue; attempts: WriteAttempt[] } {
  const attempts: WriteAttempt[] = [];
  const queue = createCompositionSaveQueue({
    ref,
    initialRecord: record("initial"),
    write: (snapshot) => {
      const pending = controlled<void>();
      attempts.push({ snapshot, resolve: () => pending.resolve(), reject: pending.reject });
      return pending.promise;
    },
  });
  return { queue, attempts };
}

async function advancePromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("revision-aware composition save queue", () => {
  it("serializes A/B/C edits and coalesces queued writes to the immutable newest snapshot", async () => {
    const { queue, attempts } = queueHarness();
    const states: string[] = [];
    queue.subscribe((state) => states.push(state.status));

    const draftA = record("A");
    expect(queue.edit(ref, draftA)).toBe(1);
    queue.edit(ref, record("B"));
    const draftC = record("C");
    expect(queue.edit(ref, draftC)).toBe(3);
    draftA.document.name = "mutated A";
    draftC.document.name = "mutated C";

    await advancePromises();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].snapshot).toMatchObject({
      revision: 1,
      record: { document: { name: "A" } },
    });
    expect(Object.isFrozen(attempts[0].snapshot.record.document)).toBe(true);

    attempts[0].resolve();
    await advancePromises();
    expect(attempts).toHaveLength(2);
    expect(attempts[1].snapshot).toMatchObject({
      revision: 3,
      record: { document: { name: "C" } },
    });
    expect(queue.state).toMatchObject({
      status: "saving",
      draftRevision: 3,
      savedRevision: 1,
      savingRevision: 3,
      draft: { document: { name: "C" } },
    });

    attempts[1].resolve();
    await queue.flush();
    expect(queue.state).toMatchObject({
      status: "saved",
      dirty: false,
      draftRevision: 3,
      savedRevision: 3,
    });
    expect(states).toContain("dirty");
    expect(states).toContain("saving");
    expect(states.at(-1)).toBe("saved");
  });

  it("halts after failure with a newer draft retained and rejects the pending flush", async () => {
    const { queue, attempts } = queueHarness();
    queue.edit(ref, record("A"));
    queue.edit(ref, record("B"));
    const failure = new Error("disk full");
    const flushResult = queue.flush().then(
      () => ({ resolved: true as const }),
      (error: unknown) => ({ resolved: false as const, error }),
    );

    await advancePromises();
    attempts[0].reject(failure);
    await advancePromises();

    expect(await flushResult).toEqual({ resolved: false, error: failure });
    expect(queue.state).toMatchObject({
      status: "error",
      error: failure,
      failedRevision: 1,
      savedRevision: 0,
      draftRevision: 2,
      draft: { document: { name: "B" } },
    });
    await advancePromises();
    expect(attempts).toHaveLength(1);
    await expect(queue.flush()).rejects.toBe(failure);
  });

  it("retries the newest draft and advances savedRevision only for matching successes", async () => {
    const { queue, attempts } = queueHarness();
    queue.edit(ref, record("A"));
    queue.edit(ref, record("B"));
    await advancePromises();
    attempts[0].reject(new Error("offline"));
    await advancePromises();

    queue.retry();
    await advancePromises();
    expect(attempts[1].snapshot).toMatchObject({
      revision: 2,
      record: { document: { name: "B" } },
    });

    queue.edit(ref, record("C"));
    attempts[1].resolve();
    await advancePromises();
    expect(queue.state).toMatchObject({
      status: "saving",
      savedRevision: 2,
      draftRevision: 3,
      savingRevision: 3,
    });
    expect(attempts[2].snapshot.revision).toBe(3);

    attempts[2].resolve();
    await queue.flush();
    expect(queue.state).toMatchObject({ status: "saved", savedRevision: 3 });
  });

  it("lets a newer edit restart persistence after failure without explicit Retry", async () => {
    const { queue, attempts } = queueHarness();
    queue.edit(ref, record("A"));
    await advancePromises();
    attempts[0].reject(new Error("temporary"));
    await advancePromises();

    queue.edit(ref, record("B"));
    await advancePromises();
    expect(queue.state.status).toBe("saving");
    expect(attempts[1].snapshot).toMatchObject({
      revision: 2,
      record: { document: { name: "B" } },
    });
    attempts[1].resolve();
    await queue.flush();
    expect(queue.state.savedRevision).toBe(2);
  });

  it("keeps flush pending until the newest revision at settlement is persisted", async () => {
    const { queue, attempts } = queueHarness();
    queue.edit(ref, record("A"));
    let flushed = false;
    const flush = queue.flush().then(() => {
      flushed = true;
    });
    queue.edit(ref, record("B"));
    await advancePromises();

    attempts[0].resolve();
    await advancePromises();
    expect(flushed).toBe(false);
    expect(attempts[1].snapshot.revision).toBe(2);
    attempts[1].resolve();
    await flush;
    expect(flushed).toBe(true);
    expect(queue.state.savedRevision).toBe(2);
  });

  it("rejects provider and record identity mismatches without changing queue state", async () => {
    expect(() =>
      createCompositionSaveQueue({
        ref,
        initialRecord: record("wrong", "composition-b"),
        write: async () => undefined,
      }),
    ).toThrow(CompositionSaveQueueIdentityError);

    const { queue, attempts } = queueHarness();
    const wrongProvider: CompositionRecordRef = { ...ref, providerId: "files" };
    expect(() => queue.edit(wrongProvider, record("provider mismatch"))).toThrow(
      CompositionSaveQueueIdentityError,
    );
    expect(() =>
      queue.edit({ ...ref, recordId: "composition-b" }, record("record mismatch", "composition-b")),
    ).toThrow(CompositionSaveQueueIdentityError);
    expect(() => queue.edit(ref, record("document mismatch", "composition-b"))).toThrow(
      CompositionSaveQueueIdentityError,
    );
    await advancePromises();
    expect(attempts).toHaveLength(0);
    expect(queue.state).toMatchObject({ status: "saved", draftRevision: 0, savedRevision: 0 });
  });

  it.each([
    ["success", (attempt: WriteAttempt) => attempt.resolve()],
    ["error", (attempt: WriteAttempt) => attempt.reject(new Error("late failure"))],
  ])("ignores stale %s after close while saving", async (_kind, settle) => {
    const { queue, attempts } = queueHarness();
    queue.edit(ref, record("A"));
    await advancePromises();

    const close = queue.close();
    expect(queue.state).toMatchObject({
      status: "dirty",
      dirty: true,
      saving: false,
      closed: true,
      draftRevision: 1,
      savedRevision: 0,
    });
    await expect(queue.flush()).rejects.toBeInstanceOf(CompositionSaveQueueClosedError);
    expect(() => queue.edit(ref, record("B"))).toThrow(CompositionSaveQueueClosedError);
    expect(() => queue.retry()).toThrow(CompositionSaveQueueClosedError);

    settle(attempts[0]);
    await close;
    expect(queue.state).toMatchObject({
      status: "dirty",
      closed: true,
      draftRevision: 1,
      savedRevision: 0,
    });
    expect(queue.close()).toBe(close);
  });

  it("turns a synchronous writer throw into guarded error state without an unhandled rejection", async () => {
    const failure = new Error("sync failure");
    const queue = createCompositionSaveQueue({
      ref,
      initialRecord: record("initial"),
      write: () => {
        throw failure;
      },
    });
    queue.edit(ref, record("A"));
    const result = queue.flush().catch((error: unknown) => error);
    await advancePromises();
    expect(await result).toBe(failure);
    expect(queue.state).toMatchObject({ status: "error", error: failure, savedRevision: 0 });
  });
});
