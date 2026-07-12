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
  SerializedRect,
} from "./protocol";
import {
  commitInlineEditMessage,
  errorMessage,
  readParentToPreview,
  readyMessage,
  requestAddMessage,
  requestInsertMenuMessage,
  requestNodeMenuMessage,
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
  /**
   * The host answered a `request-node-menu` / `request-insert-menu` with a
   * `restore-focus` (issue #256). NOT revision-gated and never touches
   * `PreviewState` — see `snapshot-store.ts`'s `applyInbound` comment.
   */
  onRestoreFocus?: (focusToken: string) => void;
  /** A message was DROPPED by the guard. */
  onRejected?: (reason: GuardFailure, detail?: string) => void;
}

export interface PreviewClient {
  /** Announce readiness. Called on every load — including after a reload. */
  emitReady(): void;
  emitSelect(nodeId: string | null): void;
  emitRequestAdd(target: InsertionTarget): void;
  /** The selected node's chrome "⋯" was activated (issue #256). */
  emitRequestNodeMenu(nodeId: string, rect: SerializedRect, focusToken: string): void;
  /** An insert point's "⋯" was activated (issue #256). */
  emitRequestInsertMenu(target: InsertionTarget, rect: SerializedRect, focusToken: string): void;
  /**
   * An inline-editing session committed a new value (issue #257). Stamped with
   * the revision on screen (`documentRevision`) so the host can drop a stale
   * commit — exactly like `emitSelect`/`emitRequestAdd` stamp theirs.
   */
  emitCommitInlineEdit(nodeId: string, fieldKey: string, value: string): void;
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
    const message = result.message;
    // `restore-focus` (#256) is not a document/session snapshot — it never
    // reaches the revision-gated fold below. See `applyInbound`'s comment.
    if (message.type === "restore-focus") {
      options.onRestoreFocus?.(message.focusToken);
      return;
    }
    const next = applyInbound(state, message);
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
    emitRequestNodeMenu(nodeId, rect, focusToken) {
      post(requestNodeMenuMessage(outboundRevision(), nodeId, rect, focusToken));
    },
    emitRequestInsertMenu(target, rect, focusToken) {
      post(requestInsertMenuMessage(outboundRevision(), target, rect, focusToken));
    },
    emitCommitInlineEdit(nodeId, fieldKey, value) {
      post(commitInlineEditMessage(nodeId, fieldKey, value, outboundRevision()));
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
