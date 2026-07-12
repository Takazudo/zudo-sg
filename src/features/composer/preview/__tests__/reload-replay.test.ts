// The reload/late-ready replay, proved END TO END: the REAL parent bridge wired
// to the REAL iframe client over fake windows.
//
// The unit suites on either side can each pass while the pair still deadlocks,
// so this file exists to hold the seam. It regression-tests a bug neither side
// could see alone:
//
//   The bridge cannot observe an iframe reload, so `ready` stays true on its
//   side. If the parent posts between the reload and the new `ready` — a theme
//   toggle sends a document-less `mode` message — the freshly booted document
//   accepts it and its revision jumps to the retained one. Replaying the
//   snapshot at that same (now equal) revision was then rejected as stale by the
//   iframe's `revision > current` guard, and the preview stayed blank FOREVER.
//   The replay now mints a fresh revision, so it is strictly newer than anything
//   the iframe can already have applied.

import { describe, expect, it } from "vitest";
import { SAMPLE_DOCUMENT, createSampleDocument } from "@/composer";
import { createComposerPreviewBridge } from "../bridge";
import { createPreviewClient, type PreviewClient } from "../client";
import {
  renderMessage,
  type MessageEventLike,
  type MessageTarget,
  type PreviewSession,
} from "../protocol";

const ORIGIN = "https://sg.example.com";
const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };
const DARK_PREVIEW: PreviewSession = { mode: "preview", theme: "dark", selectedId: null };

/** A message bus standing in for one window's `message` event target. */
function bus(): MessageTarget & { deliver(event: MessageEventLike): void } {
  const listeners = new Set<(event: MessageEventLike) => void>();
  return {
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
    deliver: (event) => {
      for (const listener of [...listeners]) listener(event);
    },
  };
}

/**
 * A wired parent + iframe pair.
 *
 * `boot()` models a document loading into the frame; `reload()` models a real
 * reload — the DOCUMENT is replaced (fresh bus, fresh client, state back to
 * revision -1) while the frame's `contentWindow` identity, which the parent's
 * source check depends on and which a browser preserves across a same-origin
 * navigation, stays the same object.
 */
function wire() {
  const parentBus = bus();
  let iframeBus = bus();
  let client: PreviewClient | null = null;

  const contentWindow = {
    postMessage: (message: unknown) => {
      iframeBus.deliver({ data: message, origin: ORIGIN, source: parentWindowRef });
    },
  };
  const parentWindowRef = {
    postMessage: (message: unknown) => {
      parentBus.deliver({ data: message, origin: ORIGIN, source: contentWindow });
    },
  };

  const bridge = createComposerPreviewBridge({
    frame: { contentWindow },
    location: { src: "/composer/preview", targetOrigin: ORIGIN },
    hostWindow: parentBus,
  });

  const rig = {
    bridge,
    /** Load a document into the frame. Does NOT announce `ready` yet. */
    boot(): void {
      client = createPreviewClient({
        hostWindow: iframeBus,
        parentWindow: parentWindowRef,
        expectedSource: parentWindowRef,
        expectedOrigin: ORIGIN,
        targetOrigin: ORIGIN,
        onState: () => undefined,
      });
    },
    /** The loaded document announces itself. */
    announceReady(): void {
      rig.client.emitReady();
    },
    /** A full reload: the old document goes away, a new one loads and announces. */
    reload(): void {
      client?.dispose();
      iframeBus = bus();
      rig.boot();
      rig.announceReady();
    },
    /** Post a raw message straight into the frame, bypassing the bridge. */
    deliverToIframe(data: unknown): void {
      iframeBus.deliver({ data, origin: ORIGIN, source: parentWindowRef });
    },
    get client(): PreviewClient {
      if (!client) throw new Error("no document is loaded in the frame");
      return client;
    },
  };
  return rig;
}

describe("bridge ⇄ client, end to end", () => {
  it("delivers a snapshot to a ready iframe", () => {
    const rig = wire();
    rig.boot();
    rig.announceReady();

    rig.bridge.render(SAMPLE_DOCUMENT, EDIT);
    expect(rig.client.state.document).toEqual(SAMPLE_DOCUMENT);
    expect(rig.client.state.session).toEqual(EDIT);
  });

  it("a LATE iframe receives only the NEWEST snapshot when it finally boots", () => {
    const rig = wire();

    const older = createSampleDocument();
    older.name = "older";
    const newest = createSampleDocument();
    newest.name = "newest";
    // Nothing is listening yet.
    rig.bridge.render(older, EDIT);
    rig.bridge.render(newest, EDIT);

    rig.boot();
    rig.announceReady();

    expect(rig.client.state.document?.name).toBe("newest");
  });

  it("RELOAD → the reloaded preview gets the document back", () => {
    const rig = wire();
    rig.boot();
    rig.announceReady();
    rig.bridge.render(SAMPLE_DOCUMENT, EDIT);
    expect(rig.client.state.document).not.toBeNull();

    rig.reload();

    expect(rig.client.state.document, "the reloaded preview must be repopulated").toEqual(
      SAMPLE_DOCUMENT,
    );
  });

  it("RELOAD with a session change RACING the new `ready` — the document still lands", () => {
    // THE REGRESSION.
    const rig = wire();
    rig.boot();
    rig.announceReady();
    rig.bridge.render(SAMPLE_DOCUMENT, EDIT);

    // ── the iframe reloads; the fresh document is listening but has not yet
    //    announced itself, and the parent still believes it is ready ──
    rig.client.dispose();
    rig.boot();

    // A theme toggle races in as a document-less `mode` message.
    rig.bridge.updateSession(DARK_PREVIEW);
    expect(rig.client.state.session).toEqual(DARK_PREVIEW);
    expect(rig.client.state.document).toBeNull(); // …and it has NO document.

    // Now it announces itself. The replay must be strictly newer than that
    // racing message, or the preview is blank forever.
    rig.announceReady();

    expect(rig.client.state.document, "the replay must beat the racing session update").toEqual(
      SAMPLE_DOCUMENT,
    );
    expect(rig.client.state.session).toEqual(DARK_PREVIEW);
  });

  it("a re-delivered STALE snapshot never overtakes the newest one", () => {
    const rig = wire();
    rig.boot();
    rig.announceReady();

    const newest = createSampleDocument();
    newest.name = "newest";
    const revision = rig.bridge.render(newest, EDIT);
    expect(rig.client.state.document?.name).toBe("newest");

    // A delayed / duplicated delivery of an older snapshot, straight into the
    // frame at a lower revision.
    const older = createSampleDocument();
    older.name = "older";
    rig.deliverToIframe(renderMessage(revision - 1, older, EDIT));
    rig.deliverToIframe(renderMessage(0, older, DARK_PREVIEW));

    expect(rig.client.state.document?.name).toBe("newest");
    expect(rig.client.state.session).toEqual(EDIT);
    expect(rig.client.state.revision).toBe(revision);
  });
});
