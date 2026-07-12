"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The parent-side canvas: the preview `<iframe>` host + its bridge lifecycle
// (issue #251). This is the ONE place #248's secure bridge is driven for the
// main canvas — instance-scoped, so wave 6 (#254) can mount a SECOND host for
// the chooser's live per-entry preview without any shared singleton.
//
// Lifecycle contract (all delegated to #248's `createComposerPreviewBridge`):
//   - build the base-aware URL + exact origin once; spread the sandboxed,
//     titled iframe props;
//   - the bridge retains the newest snapshot and, on ready/late-ready/reload,
//     replays it at a fresh revision — so the effect below only has to send the
//     current snapshot whenever it changes;
//   - a DOCUMENT change is a full `render`; a session-only change
//     (mode/theme/selection) is a lighter `updateSession`. One document
//     snapshot drives the preview — there is no second source mapping.
//
// Inbound: a canvas node click arrives as `select` (Edit mode only — the
// renderer never selects in Preview); an insert point arrives as `request-add`
// carrying #245's index-bearing `InsertionTarget`. Before opening the shared
// chooser we FOCUS the iframe, so it is captured as the chooser's trigger and
// focus returns to it on close (issue #251 scope item 3). Recoverable renderer
// errors surface as a dismissible banner above the canvas.

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { CompositionDocument, InsertionTarget } from "@/composer";
import type { ComposerCanvasViewport } from "@/features/composer/chrome/controller-model";
import {
  buildComposerPreviewUrl,
  composerPreviewFrameProps,
  createComposerPreviewBridge,
  type ComposerPreviewBridge,
  type ComposerPreviewLocation,
  type MessageTarget,
  type PreviewSession,
} from "@/features/composer/preview";
import { COMPOSER_VIEWPORT_WIDTHS } from "./viewport";

export interface ComposerCanvasHostProps {
  document: CompositionDocument;
  session: PreviewSession;
  viewport: ComposerCanvasViewport;
  /** A canvas node (or the empty canvas, `null`) was selected in Edit mode. */
  onSelect: (nodeId: string | null) => void;
  /** An insert point was activated — carries #245's index-bearing target. */
  onRequestAdd: (target: InsertionTarget) => void;

  // ── Test seams (production defaults) ──────────────────────────────────────
  /** Override the bridge factory. Defaults to #248's real bridge. */
  createBridge?: typeof createComposerPreviewBridge;
  /** Override the resolved iframe location. Defaults to the base-aware URL. */
  location?: ComposerPreviewLocation;
  /** Override the window hosting the `message` listener. Defaults to `window`. */
  hostWindow?: MessageTarget;
}

export function ComposerCanvasHost(props: ComposerCanvasHostProps): JSX.Element {
  const {
    document: doc,
    session,
    viewport,
    onSelect,
    onRequestAdd,
    createBridge = createComposerPreviewBridge,
    location: locationProp,
    hostWindow,
  } = props;

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<ComposerPreviewBridge | null>(null);
  const prevDocRef = useRef<CompositionDocument | null>(null);
  // The bridge is created ONCE; its callbacks read the latest props through
  // this ref so a controller state change never needs to re-create the bridge
  // (which would drop readiness and re-add a listener).
  const handlersRef = useRef({ onSelect, onRequestAdd });
  handlersRef.current = { onSelect, onRequestAdd };

  const [renderError, setRenderError] = useState<string | null>(null);
  const [, setReady] = useState(false);

  const location = useMemo(
    () => locationProp ?? buildComposerPreviewUrl(),
    [locationProp],
  );
  const frameProps = useMemo(() => composerPreviewFrameProps(location), [location]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const bridge = createBridge({
      frame,
      location,
      hostWindow: hostWindow ?? window,
      onReady: () => setReady(true),
      onSelect: (nodeId) => handlersRef.current.onSelect(nodeId),
      onRequestAdd: (target) => {
        // Focus the iframe BEFORE the chooser opens so it becomes the chooser's
        // captured trigger — focus then returns here on close.
        frameRef.current?.focus();
        handlersRef.current.onRequestAdd(target);
      },
      onError: (message, recoverable) => {
        if (recoverable) setRenderError(message);
      },
    });
    bridgeRef.current = bridge;
    return () => {
      bridge.dispose();
      bridgeRef.current = null;
    };
    // Production: these are all stable. If a test swaps the factory/location the
    // snapshot effect below re-sends on the next document/session change.
  }, [createBridge, location, hostWindow]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (prevDocRef.current !== doc) {
      prevDocRef.current = doc;
      setRenderError(null);
      bridge.render(doc, session);
    } else {
      bridge.updateSession(session);
    }
  }, [doc, session]);

  const width = COMPOSER_VIEWPORT_WIDTHS[viewport];
  const frameStyle = width === null ? undefined : { width: `${width}px`, maxWidth: "100%" };

  return (
    <div class="sg-composer-canvas-host" data-sg-viewport={viewport}>
      {renderError !== null && (
        <div class="sg-composer-canvas-error" role="status">
          <span>Preview error: {renderError}</span>
          <button
            type="button"
            class="sg-composer-toolbar-button"
            onClick={() => setRenderError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      <div class="sg-composer-canvas-frame" style={frameStyle}>
        <iframe ref={frameRef} class="sg-composer-preview-iframe" {...frameProps} />
      </div>
    </div>
  );
}
