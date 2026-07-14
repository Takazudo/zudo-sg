import { cloneJson } from "../model/json";
import type {
  CompositionPutResult,
  CompositionRecord,
  CompositionRecordRef,
  CompositionSaveOutcome,
} from "../library/types";

export interface CompositionSaveSnapshot {
  readonly ref: Readonly<CompositionRecordRef>;
  readonly revision: number;
  /** A detached, deeply frozen copy of the draft accepted for this revision. */
  readonly record: CompositionRecord;
}

interface CompositionSaveQueueStateBase {
  readonly ref: Readonly<CompositionRecordRef>;
  readonly draft: CompositionRecord;
  readonly draftRevision: number;
  readonly savedRevision: number;
  readonly closed: boolean;
}

export interface CompositionSaveQueueDirtyState extends CompositionSaveQueueStateBase {
  readonly status: "dirty";
  readonly dirty: true;
  readonly saving: false;
  readonly error: null;
}

export interface CompositionSaveQueueSavingState extends CompositionSaveQueueStateBase {
  readonly status: "saving";
  readonly dirty: true;
  readonly saving: true;
  readonly error: null;
  readonly savingRevision: number;
}

export interface CompositionSaveQueueSavedState extends CompositionSaveQueueStateBase {
  readonly status: "saved";
  readonly dirty: false;
  readonly saving: false;
  readonly error: null;
  /** Present only when a provider reports canonical and derived output separately. */
  readonly outcome?: CompositionSaveOutcome;
}

export interface CompositionSaveQueueErrorState extends CompositionSaveQueueStateBase {
  readonly status: "error";
  readonly dirty: true;
  readonly saving: false;
  readonly error: Error;
  readonly failedRevision: number;
}

export type CompositionSaveQueueState =
  | CompositionSaveQueueDirtyState
  | CompositionSaveQueueSavingState
  | CompositionSaveQueueSavedState
  | CompositionSaveQueueErrorState;

export type CompositionSaveQueueListener = (state: CompositionSaveQueueState) => void;
export type CompositionSaveWriter = (snapshot: CompositionSaveSnapshot) => Promise<CompositionPutResult>;

export interface CompositionSaveQueueOptions {
  readonly ref: CompositionRecordRef;
  /** The already-persisted record from which revision zero starts. */
  readonly initialRecord: CompositionRecord;
  readonly write: CompositionSaveWriter;
}

export interface CompositionSaveQueue {
  readonly ref: Readonly<CompositionRecordRef>;
  readonly state: CompositionSaveQueueState;

  /** Accept a new draft and synchronously return its monotonically increasing revision. */
  edit(ref: CompositionRecordRef, record: CompositionRecord): number;
  /** Retry the newest retained draft after a failure. */
  retry(): void;
  /** Resolve once the newest draft is saved, or reject at the first persistent failure. */
  flush(): Promise<void>;
  /**
   * Detach immediately and resolve after the current write settles. Pending drafts are not
   * started; route transitions that require persistence must successfully flush first.
   */
  close(): Promise<void>;
  /** Subscribe to state transitions. The current state is delivered immediately. */
  subscribe(listener: CompositionSaveQueueListener): () => void;
}

export class CompositionSaveQueueIdentityError extends Error {
  readonly name = "CompositionSaveQueueIdentityError";

  constructor(
    readonly expected: Readonly<CompositionRecordRef>,
    readonly received: Readonly<CompositionRecordRef>,
  ) {
    super(
      `Save queue identity mismatch: expected ${expected.providerId}/${expected.recordId}, ` +
        `received ${received.providerId}/${received.recordId}.`,
    );
  }
}

export class CompositionSaveQueueClosedError extends Error {
  readonly name = "CompositionSaveQueueClosedError";

  constructor() {
    super("The composition save queue is closed.");
  }
}

interface Attempt {
  readonly token: symbol;
  readonly snapshot: CompositionSaveSnapshot;
  readonly settled: Promise<void>;
}

interface FlushWaiter {
  readonly resolve: () => void;
  readonly reject: (reason: Error) => void;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function cloneRecord(record: CompositionRecord): CompositionRecord {
  return deepFreeze(cloneJson(record));
}

function cloneRef(ref: CompositionRecordRef): Readonly<CompositionRecordRef> {
  return Object.freeze({ ...ref });
}

function sameRef(a: Readonly<CompositionRecordRef>, b: Readonly<CompositionRecordRef>): boolean {
  return a.providerId === b.providerId && a.recordId === b.recordId;
}

function saveError(reason: unknown): Error {
  return reason instanceof Error
    ? reason
    : new Error("Composition persistence failed.", { cause: reason });
}

class RevisionAwareCompositionSaveQueue implements CompositionSaveQueue {
  readonly ref: Readonly<CompositionRecordRef>;

  private readonly write: CompositionSaveWriter;
  private readonly listeners = new Set<CompositionSaveQueueListener>();
  private readonly flushWaiters = new Set<FlushWaiter>();
  private latest: CompositionSaveSnapshot;
  private savedRevision = 0;
  private lastOutcome: CompositionSaveOutcome | undefined;
  private active: Attempt | null = null;
  private failure: { revision: number; error: Error } | null = null;
  private isClosed = false;
  private closePromise: Promise<void> | null = null;
  private currentState: CompositionSaveQueueState;

  constructor(options: CompositionSaveQueueOptions) {
    this.ref = cloneRef(options.ref);
    this.assertIdentity(options.ref, options.initialRecord);
    this.write = options.write;
    this.latest = deepFreeze({
      ref: this.ref,
      revision: 0,
      record: cloneRecord(options.initialRecord),
    });
    this.currentState = this.buildState();
  }

  get state(): CompositionSaveQueueState {
    return this.currentState;
  }

  edit(ref: CompositionRecordRef, record: CompositionRecord): number {
    this.assertOpen();
    this.assertIdentity(ref, record);

    const revision = this.latest.revision + 1;
    this.latest = deepFreeze({ ref: this.ref, revision, record: cloneRecord(record) });
    this.failure = null;
    this.lastOutcome = undefined;
    this.publish();
    this.startNewestAttempt();
    return revision;
  }

  retry(): void {
    this.assertOpen();
    if (this.active || this.savedRevision === this.latest.revision) return;
    this.failure = null;
    this.publish();
    this.startNewestAttempt();
  }

  flush(): Promise<void> {
    if (this.isClosed) return Promise.reject(new CompositionSaveQueueClosedError());
    if (this.failure) return Promise.reject(this.failure.error);
    if (this.savedRevision === this.latest.revision) return Promise.resolve();

    const promise = new Promise<void>((resolve, reject) => {
      this.flushWaiters.add({ resolve, reject });
    });
    this.startNewestAttempt();
    return promise;
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;

    this.isClosed = true;
    const error = new CompositionSaveQueueClosedError();
    this.rejectFlushWaiters(error);
    const activeSettlement = this.active?.settled ?? Promise.resolve();
    this.publish();
    this.closePromise = activeSettlement.then(() => undefined);
    return this.closePromise;
  }

  subscribe(listener: CompositionSaveQueueListener): () => void {
    this.listeners.add(listener);
    this.deliver(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private assertOpen(): void {
    if (this.isClosed) throw new CompositionSaveQueueClosedError();
  }

  private assertIdentity(ref: CompositionRecordRef, record: CompositionRecord): void {
    if (!sameRef(this.ref, ref)) throw new CompositionSaveQueueIdentityError(this.ref, ref);
    if (ref.recordId !== record.id) {
      throw new CompositionSaveQueueIdentityError(this.ref, {
        providerId: ref.providerId,
        recordId: record.id,
      });
    }
    if (record.document.id !== record.id) {
      throw new CompositionSaveQueueIdentityError(this.ref, {
        providerId: ref.providerId,
        recordId: record.document.id,
      });
    }
  }

  private startNewestAttempt(): void {
    if (
      this.isClosed ||
      this.active ||
      this.failure ||
      this.savedRevision === this.latest.revision
    ) {
      return;
    }

    const snapshot = this.latest;
    const token = Symbol(`composition-save-${snapshot.revision}`);
    const settled = Promise.resolve()
      .then(() => this.write(snapshot))
      .then(
        (result) => this.finishSuccess(token, snapshot, result),
        (reason: unknown) => this.finishFailure(token, snapshot, reason),
      );
    this.active = { token, snapshot, settled };
    this.publish();
  }

  private finishSuccess(token: symbol, snapshot: CompositionSaveSnapshot, result: CompositionPutResult): void {
    if (!this.active || this.active.token !== token) return;
    this.active = null;
    if (this.isClosed || !sameRef(snapshot.ref, this.ref)) return;

    this.savedRevision = Math.max(this.savedRevision, snapshot.revision);
    this.lastOutcome = result === undefined ? undefined : result;
    this.publish();
    if (this.savedRevision === this.latest.revision) {
      this.resolveFlushWaiters();
      return;
    }
    this.startNewestAttempt();
  }

  private finishFailure(
    token: symbol,
    snapshot: CompositionSaveSnapshot,
    reason: unknown,
  ): void {
    if (!this.active || this.active.token !== token) return;
    this.active = null;
    if (this.isClosed || !sameRef(snapshot.ref, this.ref)) return;

    const error = saveError(reason);
    this.failure = { revision: snapshot.revision, error };
    this.rejectFlushWaiters(error);
    this.publish();
  }

  private buildState(): CompositionSaveQueueState {
    const base = {
      ref: this.ref,
      draft: this.latest.record,
      draftRevision: this.latest.revision,
      savedRevision: this.savedRevision,
      closed: this.isClosed,
    } as const;

    if (this.failure) {
      return Object.freeze({
        ...base,
        status: "error",
        dirty: true,
        saving: false,
        error: this.failure.error,
        failedRevision: this.failure.revision,
      });
    }
    if (this.active && !this.isClosed) {
      return Object.freeze({
        ...base,
        status: "saving",
        dirty: true,
        saving: true,
        error: null,
        savingRevision: this.active.snapshot.revision,
      });
    }
    if (this.savedRevision === this.latest.revision) {
      return Object.freeze({
        ...base,
        status: "saved",
        dirty: false,
        saving: false,
        error: null,
        ...(this.lastOutcome === undefined ? {} : { outcome: this.lastOutcome }),
      });
    }
    return Object.freeze({
      ...base,
      status: "dirty",
      dirty: true,
      saving: false,
      error: null,
    });
  }

  private publish(): void {
    this.currentState = this.buildState();
    for (const listener of [...this.listeners]) this.deliver(listener);
  }

  private deliver(listener: CompositionSaveQueueListener): void {
    try {
      listener(this.currentState);
    } catch {
      // State observers must not corrupt persistence ordering or reject an internal write.
    }
  }

  private resolveFlushWaiters(): void {
    if (this.savedRevision !== this.latest.revision || this.failure || this.isClosed) return;
    const waiters = [...this.flushWaiters];
    this.flushWaiters.clear();
    for (const waiter of waiters) waiter.resolve();
  }

  private rejectFlushWaiters(error: Error): void {
    const waiters = [...this.flushWaiters];
    this.flushWaiters.clear();
    for (const waiter of waiters) waiter.reject(error);
  }
}

export function createCompositionSaveQueue(
  options: CompositionSaveQueueOptions,
): CompositionSaveQueue {
  return new RevisionAwareCompositionSaveQueue(options);
}
