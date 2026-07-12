"use client";

// The client-only app that runs INSIDE the Composer preview iframe.
//
// It is the trusted side of the boundary: it imports the Composer runtime
// registry (#244) itself, so the real component functions are resolved HERE and
// never travel over the bridge. What crosses the bridge is JSON only.
//
// Boot order matters. The listener is installed BEFORE `ready` is announced, so
// the parent's answering snapshot can never arrive before anything is listening.
// Because `ready` is emitted on every load, a late load or a reload replays the
// parent's newest snapshot (see `bridge.ts`) — and the freshly booted state
// starts at revision `-1`, so it accepts it.
//
// Written with `h()` rather than JSX for the same reason as `renderer.ts`: a
// root-`src` `.tsx` module cannot be imported by the current vitest config
// (owned by #247), and keeping this JSX-free keeps it testable.

import { h } from "preact";
import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { InsertionTarget } from "@/composer";
import { composerEntries } from "@/styleguide/data/composer-registry";
import { createPreviewClient, type PreviewClient } from "./client";
import type { GuardFailure, MessagePoster, MessageTarget } from "./protocol";
import { CompositionCanvas } from "./renderer";
import { INITIAL_PREVIEW_STATE, type PreviewState } from "./snapshot-store";

/** Human-readable copy for a message the guard threw away. */
function rejectionMessage(reason: GuardFailure): string {
  switch (reason) {
    case "wrong-source":
      return "A preview message arrived from an unexpected window and was ignored.";
    case "wrong-origin":
      return "A preview message arrived from an unexpected origin and was ignored.";
    case "invalid-payload":
      return "The Composer sent a message this preview could not understand. The last valid composition is still shown.";
  }
}

export default function ComposerPreviewApp(): JSX.Element {
  const [state, setState] = useState<PreviewState>(INITIAL_PREVIEW_STATE);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<PreviewClient | null>(null);

  useEffect(() => {
    const hostWindow = window as unknown as MessageTarget;
    const parentWindow = window.parent as unknown as MessagePoster;
    const origin = window.location.origin;

    const client = createPreviewClient({
      hostWindow,
      parentWindow,
      // The parent frame is the ONLY window this preview will take orders from.
      expectedSource: window.parent,
      // Same-origin by construction: anything else is a foreign frame.
      expectedOrigin: origin,
      // Exact target origin — never "*".
      targetOrigin: origin,
      onState: (next) => {
        setState(next);
        // A valid snapshot means the bridge is healthy again.
        setError(null);
      },
      onRejected: (reason, detail) => {
        const message = rejectionMessage(reason);
        setError(message);
        // Surface it to the host too — a silently dropped message is the kind of
        // bug that only shows up as "the canvas stopped updating".
        client.emitError(detail ? `${message} (${detail})` : message, true);
      },
    });
    clientRef.current = client;

    client.emitReady();

    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  // Mirror the host's active theme onto THIS document. `colors.css` keys
  // `color-scheme` off `:root[data-theme]`, which is what makes every
  // `light-dark()` token in the restored palette resolve to the right mode.
  useEffect(() => {
    document.documentElement.dataset.theme = state.session.theme;
  }, [state.session.theme]);

  const onSelect = useCallback((nodeId: string | null) => {
    clientRef.current?.emitSelect(nodeId);
  }, []);

  const onRequestAdd = useCallback((target: InsertionTarget) => {
    clientRef.current?.emitRequestAdd(target);
  }, []);

  const onNodeError = useCallback((nodeId: string, message: string) => {
    clientRef.current?.emitError(`Node "${nodeId}" failed to render: ${message}`, true);
  }, []);

  const banner =
    error === null
      ? null
      : h(
          "div",
          { class: "zc-error", role: "alert" },
          h("p", { class: "zc-error-title" }, "Preview problem"),
          h("p", { class: "zc-error-detail" }, error),
          h(
            "button",
            {
              type: "button",
              class: "zc-error-dismiss",
              "data-zc-affordance": "",
              onClick: () => setError(null),
            },
            "Dismiss",
          ),
        );

  const body = state.document
    ? h(CompositionCanvas, {
        document: state.document,
        entries: composerEntries,
        session: state.session,
        revision: state.revision,
        onSelect,
        onRequestAdd,
        onNodeError,
      })
    : h("p", { class: "zc-empty" }, "Waiting for a composition…");

  return h("div", { "data-composer-preview-root": "" }, banner, body);
}

ComposerPreviewApp.displayName = "ComposerPreviewApp";
