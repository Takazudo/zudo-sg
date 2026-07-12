// PARENT-SIDE half of the Composer preview bridge: the base-aware iframe URL,
// the exact target origin, and an INSTANCE-SCOPED connection handle.
//
// ── Why instance-scoped, not a module singleton ──────────────────────────────
// Wave 6 (#254) mounts a SECOND, ephemeral preview iframe for the chooser's
// live per-entry preview, alive at the same time as the canvas preview. Every
// piece of connection state (readiness, the revision counter, the newest
// snapshot, the listener) therefore lives in a closure per `createComposerPreviewBridge`
// call. Two bridges never see each other's `ready`, and neither can be
// desynchronised by the other's revisions.
//
// ── Revision + replay contract ───────────────────────────────────────────────
// - Every `render()` / `updateSession()` mints the NEXT revision (monotonic).
// - The newest snapshot is always retained. If the iframe is not ready yet, the
//   snapshot is held, not queued: a second `render()` REPLACES the first, so an
//   older document can never be delivered after a newer one.
// - On `ready` (first load, a late load, or a RELOAD) the bridge replays ONLY
//   the retained newest snapshot, at its existing revision. A freshly loaded
//   document starts at revision `-1` and accepts it; a still-live document that
//   re-announced `ready` has already applied that revision and ignores it. Both
//   outcomes are correct, and neither can resurrect an older document.
//
// ── Origin contract ──────────────────────────────────────────────────────────
// `targetOrigin` is DERIVED from the resolved iframe URL and used verbatim on
// every `postMessage`. It is never `"*"`. Inbound messages must come from the
// iframe's own `contentWindow` AND carry that same origin (the preview is
// same-origin by construction).

import type { CompositionDocument, InsertionTarget } from "@/composer";
import { withBase } from "@/utils/base";
import { COMPOSER_PREVIEW_IFRAME_TITLE, COMPOSER_PREVIEW_ROUTE_PATH } from "./route";
import type {
  GuardFailure,
  MessageEventLike,
  MessagePoster,
  MessageTarget,
  PreviewSession,
} from "./protocol";
import { modeMessage, readPreviewToParent, renderMessage } from "./protocol";

// ── URL + iframe seam ───────────────────────────────────────────────────────

/** The resolved preview iframe location: what to load, and who to talk to. */
export interface ComposerPreviewLocation {
  /** Value for the iframe's `src` — base-prefixed, trailing-slash normalized. */
  src: string;
  /** EXACT origin for every `postMessage`. Derived from `src`. Never `"*"`. */
  targetOrigin: string;
}

/**
 * Build the preview iframe's URL and its exact target origin.
 *
 * `withBase` applies BOTH the configured `settings.base` (so a site served from
 * `/app/` loads `/app/composer/preview`, not `/composer/preview`) and
 * `settings.trailingSlash`. The origin is then read back off the RESOLVED URL
 * rather than assumed, which is what makes the exact-origin `postMessage`
 * honest even if the base ever becomes absolute.
 *
 * @param documentOrigin origin of the hosting document; defaults to
 *   `location.origin`. Explicit so the helper is testable and so a caller in a
 *   non-browser context fails loudly instead of silently posting to `"*"`.
 */
export function buildComposerPreviewUrl(documentOrigin?: string): ComposerPreviewLocation {
  const origin = documentOrigin ?? globalThis.location?.origin;
  if (!origin) {
    throw new Error(
      "buildComposerPreviewUrl: no document origin — pass one explicitly outside a browser.",
    );
  }
  const resolved = new URL(withBase(COMPOSER_PREVIEW_ROUTE_PATH), origin);
  return { src: resolved.pathname, targetOrigin: resolved.origin };
}

/** The iframe attributes the HOST seam (#247 shell / #251 canvas) must apply. */
export interface ComposerPreviewFrameProps {
  src: string;
  /** Accessible name — an iframe without one is an unlabelled landmark. */
  title: string;
  /** Same-origin so the parent can address `contentWindow`; scripts for Preact. */
  sandbox: string;
}

/**
 * The iframe props for a resolved preview location. Exported so the mount site
 * cannot forget the accessible title or widen the sandbox.
 */
export function composerPreviewFrameProps(
  location: ComposerPreviewLocation,
  title: string = COMPOSER_PREVIEW_IFRAME_TITLE,
): ComposerPreviewFrameProps {
  return { src: location.src, title, sandbox: "allow-same-origin allow-scripts" };
}

// ── Connection ──────────────────────────────────────────────────────────────

/** Structural stand-in for `HTMLIFrameElement` (real ones are assignable). */
export interface PreviewFrameLike {
  readonly contentWindow: MessagePoster | null;
}

export interface ComposerPreviewBridgeOptions {
  /** The iframe. Its `contentWindow` is BOTH the post target and the only source trusted. */
  frame: PreviewFrameLike;
  /** From `buildComposerPreviewUrl(...).targetOrigin`. */
  targetOrigin: string;
  /** Window hosting the `message` listener — normally the parent `window`. */
  hostWindow: MessageTarget;
  /** Origin every inbound message must carry. Defaults to `targetOrigin`. */
  expectedOrigin?: string;

  onReady?: () => void;
  onSelect?: (nodeId: string | null, revision: number) => void;
  onRequestAdd?: (target: InsertionTarget, revision: number) => void;
  onError?: (message: string, recoverable: boolean, revision: number | null) => void;
  /** A message that failed source/origin/schema validation was DROPPED. */
  onRejected?: (reason: GuardFailure, detail?: string) => void;
}

export interface ComposerPreviewBridge {
  /** Send (or retain, if not ready) a full snapshot. Returns its revision. */
  render(document: CompositionDocument, session: PreviewSession): number;
  /** Send (or retain) a session-only change. Returns its revision. */
  updateSession(session: PreviewSession): number;
  /** True once the iframe has announced `ready` at least once. */
  readonly ready: boolean;
  /** Revision of the retained newest snapshot (`-1` before the first send). */
  readonly revision: number;
  dispose(): void;
}

interface Retained {
  document: CompositionDocument | null;
  session: PreviewSession;
  revision: number;
}

export function createComposerPreviewBridge(
  options: ComposerPreviewBridgeOptions,
): ComposerPreviewBridge {
  const { frame, targetOrigin, hostWindow } = options;
  const expectedOrigin = options.expectedOrigin ?? targetOrigin;

  // ── per-instance state ────────────────────────────────────────────────────
  let ready = false;
  let revisionCounter = -1;
  let retained: Retained | null = null;
  let disposed = false;

  const nextRevision = (): number => ++revisionCounter;

  const post = (message: unknown): void => {
    // `contentWindow` is read at send time, not captured: it is null before the
    // iframe attaches and is REPLACED on reload.
    frame.contentWindow?.postMessage(message, targetOrigin);
  };

  /** Send the retained snapshot as-is (same revision) — the replay path. */
  const flush = (): void => {
    if (!ready || !retained) return;
    if (retained.document) {
      post(renderMessage(retained.revision, retained.document, retained.session));
    } else {
      post(modeMessage(retained.revision, retained.session));
    }
  };

  const onMessage = (event: MessageEventLike): void => {
    if (disposed) return;
    const result = readPreviewToParent(event, {
      source: frame.contentWindow,
      origin: expectedOrigin,
    });
    if (!result.ok) {
      options.onRejected?.(result.reason, result.detail);
      return;
    }
    const message = result.message;
    switch (message.type) {
      case "ready":
        ready = true;
        options.onReady?.();
        // Late load / reload: replay ONLY the newest snapshot.
        flush();
        return;
      case "select":
        options.onSelect?.(message.nodeId, message.revision);
        return;
      case "request-add":
        options.onRequestAdd?.(message.target, message.revision);
        return;
      case "error":
        options.onError?.(message.message, message.recoverable, message.revision);
        return;
    }
  };

  hostWindow.addEventListener("message", onMessage);

  return {
    render(document, session) {
      retained = { document, session, revision: nextRevision() };
      flush();
      return retained.revision;
    },
    updateSession(session) {
      retained = {
        document: retained?.document ?? null,
        session,
        revision: nextRevision(),
      };
      if (ready) {
        // Session-only: no need to resend the document.
        post(modeMessage(retained.revision, session));
      }
      return retained.revision;
    },
    get ready() {
      return ready;
    },
    get revision() {
      return retained?.revision ?? -1;
    },
    dispose() {
      disposed = true;
      hostWindow.removeEventListener("message", onMessage);
    },
  };
}
