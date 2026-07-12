// IFRAME-SIDE half of the Composer preview bridge.
//
// Mirrors `bridge.ts`: same guard, same exact-origin posting, same revision
// rule — but from inside the preview document. Kept out of the Preact island so
// the listener, the revision guard, and the emitters can be tested against
// plain fake windows with no DOM and no component tree.
//
// Trust: the ONLY window it accepts messages from is `window.parent`, and the
// origin must equal this document's own origin (the preview is same-origin with
// `/composer`). Everything else is dropped. `event.data` is never touched
// before the schema validates it.

import type { InsertionTarget } from "@/composer";
import type {
  GuardFailure,
  MessageEventLike,
  MessagePoster,
  MessageTarget,
} from "./protocol";
import {
  errorMessage,
  readParentToPreview,
  readyMessage,
  requestAddMessage,
  selectMessage,
} from "./protocol";
import { INITIAL_PREVIEW_STATE, applyInbound, type PreviewState } from "./snapshot-store";

export interface PreviewClientOptions {
  /** Window hosting the `message` listener — the iframe's own `window`. */
  hostWindow: MessageTarget;
  /** Where outbound messages go — the parent window. */
  parentWindow: MessagePoster;
  /** The ONLY trusted `event.source`. Normally the same object as `parentWindow`. */
  expectedSource: unknown;
  /** Inbound `event.origin` must equal this — this document's own origin. */
  expectedOrigin: string;
  /** Exact origin for outbound posts. Never `"*"`. */
  targetOrigin: string;
  /** A newer snapshot was applied. Stale messages never reach this. */
  onState: (state: PreviewState) => void;
  /** A message was DROPPED by the guard. */
  onRejected?: (reason: GuardFailure, detail?: string) => void;
}

export interface PreviewClient {
  /** Announce readiness. Called on every load — including after a reload. */
  emitReady(): void;
  emitSelect(nodeId: string | null): void;
  emitRequestAdd(target: InsertionTarget): void;
  emitError(message: string, recoverable?: boolean): void;
  /** The newest applied state. */
  readonly state: PreviewState;
  dispose(): void;
}

export function createPreviewClient(options: PreviewClientOptions): PreviewClient {
  const { hostWindow, parentWindow, expectedSource, expectedOrigin, targetOrigin } = options;

  let state: PreviewState = INITIAL_PREVIEW_STATE;
  let disposed = false;

  const post = (message: unknown): void => {
    parentWindow.postMessage(message, targetOrigin);
  };

  /**
   * Revision to stamp on an outbound message. Before the first snapshot lands
   * there is no canvas to interact with, so this only guards against a rogue
   * caller producing a schema-invalid negative revision.
   */
  const outboundRevision = (): number => Math.max(0, state.revision);

  const onMessage = (event: MessageEventLike): void => {
    if (disposed) return;
    const result = readParentToPreview(event, {
      source: expectedSource,
      origin: expectedOrigin,
    });
    if (!result.ok) {
      options.onRejected?.(result.reason, result.detail);
      return;
    }
    const next = applyInbound(state, result.message);
    if (!next) return; // stale revision — drop it whole
    state = next;
    options.onState(next);
  };

  hostWindow.addEventListener("message", onMessage);

  return {
    emitReady() {
      post(readyMessage());
    },
    emitSelect(nodeId) {
      post(selectMessage(outboundRevision(), nodeId));
    },
    emitRequestAdd(target) {
      post(requestAddMessage(outboundRevision(), target));
    },
    emitError(message, recoverable = true) {
      post(errorMessage(state.revision < 0 ? null : state.revision, message, recoverable));
    },
    get state() {
      return state;
    },
    dispose() {
      disposed = true;
      hostWindow.removeEventListener("message", onMessage);
    },
  };
}
