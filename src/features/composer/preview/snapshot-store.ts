// The preview iframe's snapshot state + the REVISION GUARD.
//
// Pure, DOM-free, and Preact-free on purpose: revision ordering is the part of
// this feature most likely to break silently (a late `render` overtaking a
// newer one after a reload, a re-delivered message re-applying an old document),
// so it is a plain function that can be exhaustively tested without a renderer.
//
// The rule is one line: a message is applied only when its revision is STRICTLY
// greater than the revision currently on screen. The parent mints revisions
// monotonically (`bridge.ts`), so "greater" means "newer", and a stale snapshot
// can never win — including the replay the parent sends after the iframe
// reloads and re-announces `ready`.

import type { CompositionDocument } from "@/composer";
import type { ParentToPreviewMessage, PreviewSession } from "./protocol";

/** Everything the preview draws from. */
export interface PreviewState {
  /** Revision of the newest applied message. `-1` = nothing applied yet. */
  revision: number;
  /** `null` until the first `render` arrives (a `mode` message may land first). */
  document: CompositionDocument | null;
  session: PreviewSession;
}

/**
 * The state a freshly (re)loaded preview document starts in. `revision: -1`
 * means it accepts the parent's very next message whatever its revision is —
 * which is exactly what makes the post-reload replay work.
 */
export const INITIAL_PREVIEW_STATE: PreviewState = {
  revision: -1,
  document: null,
  session: { mode: "edit", theme: "light", selectedId: null },
};

/**
 * Fold a validated parent message into the current state.
 *
 * Returns `null` when the message is STALE (revision <= current) — the caller
 * must then drop it entirely, not merge any part of it.
 */
export function applyInbound(
  state: PreviewState,
  message: ParentToPreviewMessage,
): PreviewState | null {
  if (message.revision <= state.revision) return null;

  switch (message.type) {
    case "render":
      return { revision: message.revision, document: message.document, session: message.session };
    case "mode":
      // Session-only — the document on screen is kept as-is.
      return { revision: message.revision, document: state.document, session: message.session };
    default: {
      // Compile-time exhaustiveness: appending a member to
      // PARENT_TO_PREVIEW_MEMBERS (waves 7-9) without adding a case here is a
      // TYPE ERROR. Fails CLOSED — an unhandled type is dropped rather than
      // mistaken for a session update (which would bump the revision and make
      // the next legitimate snapshot look stale).
      const unhandled: never = message;
      void unhandled;
      return null;
    }
  }
}
