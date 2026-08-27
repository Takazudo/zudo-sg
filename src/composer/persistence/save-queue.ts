// Compatibility shim for Composer persistence imports.
//
// The revision-aware implementation is shared by all authoring sub-apps.
// These concrete aliases retain the Composer API and its existing type names.

import type {
  CompositionPutResult,
  CompositionRecord,
  CompositionRecordRef,
} from "../library/types";
import {
  SaveQueueClosedError,
  SaveQueueIdentityError,
  createSaveQueue,
} from "../../shared/persistence/save-queue";
import type {
  SaveQueue,
  SaveQueueDirtyState,
  SaveQueueErrorState,
  SaveQueueListener,
  SaveQueueOptions,
  SaveQueueSavedState,
  SaveQueueSavingState,
  SaveQueueSnapshot,
  SaveQueueState,
  SaveQueueWriter,
} from "../../shared/persistence/save-queue";

export type CompositionSaveSnapshot = SaveQueueSnapshot<CompositionRecord, CompositionRecordRef>;
export type CompositionSaveQueueDirtyState = SaveQueueDirtyState<CompositionRecord, CompositionRecordRef>;
export type CompositionSaveQueueSavingState = SaveQueueSavingState<CompositionRecord, CompositionRecordRef>;
export type CompositionSaveQueueSavedState = SaveQueueSavedState<
  CompositionRecord,
  CompositionRecordRef,
  CompositionPutResult
>;
export type CompositionSaveQueueErrorState = SaveQueueErrorState<CompositionRecord, CompositionRecordRef>;
export type CompositionSaveQueueState = SaveQueueState<
  CompositionRecord,
  CompositionRecordRef,
  CompositionPutResult
>;
export type CompositionSaveQueueListener = SaveQueueListener<
  CompositionRecord,
  CompositionRecordRef,
  CompositionPutResult
>;
export type CompositionSaveWriter = SaveQueueWriter<
  CompositionRecord,
  CompositionRecordRef,
  CompositionPutResult
>;
export type CompositionSaveQueueOptions = SaveQueueOptions<
  CompositionRecord,
  CompositionRecordRef,
  CompositionPutResult
>;
export type CompositionSaveQueue = SaveQueue<
  CompositionRecord,
  CompositionRecordRef,
  CompositionPutResult
>;

export class CompositionSaveQueueIdentityError extends SaveQueueIdentityError<CompositionRecordRef> {
  readonly name = "CompositionSaveQueueIdentityError";
}

export class CompositionSaveQueueClosedError extends SaveQueueClosedError {
  readonly name = "CompositionSaveQueueClosedError";

  constructor() {
    super("The composition save queue is closed.");
  }
}

export function createCompositionSaveQueue(
  options: CompositionSaveQueueOptions,
): CompositionSaveQueue {
  return createSaveQueue<CompositionRecord, CompositionRecordRef, CompositionPutResult>(options, {
    identity: (expected, received) => new CompositionSaveQueueIdentityError(expected, received),
    closed: () => new CompositionSaveQueueClosedError(),
    persistence: (reason: unknown) =>
      reason instanceof Error
        ? reason
        : new Error("Composition persistence failed.", { cause: reason }),
  });
}
