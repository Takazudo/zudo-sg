// The iframe-side half of the bridge, driven end-to-end against fakes: the
// reload/late-ready replay, the stale-revision drop, and the exact-origin
// outbound contract.

import { describe, expect, it, vi } from "vitest";
import { SAMPLE_DOCUMENT, createSampleDocument } from "@/composer";
import { createPreviewClient } from "../client";
import {
  modeMessage,
  renderMessage,
  restoreFocusMessage,
  type MessageEventLike,
  type MessageTarget,
  type PreviewSession,
  type SerializedRect,
} from "../protocol";

const RECT: SerializedRect = { x: 5, y: 6, width: 40, height: 12 };

const ORIGIN = "https://sg.example.com";
const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };

function fakeIframeWindow(): MessageTarget & { deliver(event: MessageEventLike): void } {
  const listeners = new Set<(event: MessageEventLike) => void>();
  return {
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
    deliver: (event) => {
      for (const listener of [...listeners]) listener(event);
    },
  };
}

function setup() {
  const hostWindow = fakeIframeWindow();
  const posts: { message: unknown; targetOrigin: string }[] = [];
  const parentWindow = {
    postMessage: (message: unknown, targetOrigin: string) => {
      posts.push({ message, targetOrigin });
    },
  };
  const onState = vi.fn();
  const onRejected = vi.fn();
  const onRestoreFocus = vi.fn();
  const client = createPreviewClient({
    hostWindow,
    parentWindow,
    expectedSource: parentWindow,
    expectedOrigin: ORIGIN,
    targetOrigin: ORIGIN,
    onState,
    onRejected,
    onRestoreFocus,
  });
  const fromParent = (data: unknown, over: Partial<MessageEventLike> = {}): void => {
    hostWindow.deliver({ data, origin: ORIGIN, source: parentWindow, ...over });
  };
  return { client, posts, onState, onRejected, onRestoreFocus, fromParent, parentWindow };
}

describe("createPreviewClient", () => {
  it("announces ready to the EXACT parent origin, never '*'", () => {
    const { client, posts } = setup();
    client.emitReady();
    expect(posts).toHaveLength(1);
    expect(posts[0]!.targetOrigin).toBe(ORIGIN);
    expect(posts[0]!.message).toMatchObject({ type: "ready" });
  });

  it("applies a valid snapshot", () => {
    const { client, onState, fromParent } = setup();
    fromParent(renderMessage(0, SAMPLE_DOCUMENT, EDIT));
    expect(onState).toHaveBeenCalledTimes(1);
    expect(client.state.revision).toBe(0);
    expect(client.state.document).toEqual(SAMPLE_DOCUMENT);
  });

  it("DROPS a stale snapshot without notifying — an older document never wins", () => {
    const { client, onState, fromParent } = setup();
    const newest = createSampleDocument();
    newest.name = "newest";
    const older = createSampleDocument();
    older.name = "older";

    fromParent(renderMessage(7, newest, EDIT));
    fromParent(renderMessage(3, older, EDIT));

    expect(onState).toHaveBeenCalledTimes(1);
    expect(client.state.document?.name).toBe("newest");
    expect(client.state.revision).toBe(7);
  });

  it("accepts the parent's high-revision REPLAY after a reload (fresh state = -1)", () => {
    // A reloaded document is a brand-new client. The parent replays its retained
    // newest snapshot at its existing (already high) revision.
    const { client, fromParent } = setup();
    fromParent(renderMessage(42, SAMPLE_DOCUMENT, EDIT));
    expect(client.state.revision).toBe(42);
    expect(client.state.document).toEqual(SAMPLE_DOCUMENT);
  });

  it("DROPS messages from a foreign window or origin, and malformed payloads", () => {
    const { client, onState, onRejected, fromParent } = setup();
    fromParent(renderMessage(1, SAMPLE_DOCUMENT, EDIT), { source: { evil: true } });
    fromParent(renderMessage(1, SAMPLE_DOCUMENT, EDIT), { origin: "https://evil.example.com" });
    fromParent({ type: "render", document: SAMPLE_DOCUMENT });

    expect(onState).not.toHaveBeenCalled();
    expect(client.state.document).toBeNull();
    expect(onRejected.mock.calls.map((call) => call[0])).toEqual([
      "wrong-source",
      "wrong-origin",
      "invalid-payload",
    ]);
  });

  it("stamps outbound select / request-add with the revision on screen", () => {
    const { client, posts, fromParent } = setup();
    fromParent(renderMessage(5, SAMPLE_DOCUMENT, EDIT));
    posts.length = 0;

    client.emitSelect("prose-1");
    client.emitRequestAdd({ parentId: "stack-1", slotId: "content", index: 1 });

    expect(posts[0]!.message).toMatchObject({ type: "select", revision: 5, nodeId: "prose-1" });
    expect(posts[1]!.message).toMatchObject({
      type: "request-add",
      revision: 5,
      target: { parentId: "stack-1", slotId: "content", index: 1 },
    });
    for (const post of posts) expect(post.targetOrigin).toBe(ORIGIN);
  });

  it("stamps outbound request-node-menu / request-insert-menu with the revision on screen", () => {
    const { client, posts, fromParent } = setup();
    fromParent(renderMessage(5, SAMPLE_DOCUMENT, EDIT));
    posts.length = 0;

    client.emitRequestNodeMenu("box-1", RECT, "node-menu:box-1");
    client.emitRequestInsertMenu({ parentId: "stack-1", slotId: "content", index: 1 }, RECT, "insert-menu:x");

    expect(posts[0]!.message).toMatchObject({
      type: "request-node-menu",
      revision: 5,
      nodeId: "box-1",
      rect: RECT,
      focusToken: "node-menu:box-1",
    });
    expect(posts[1]!.message).toMatchObject({
      type: "request-insert-menu",
      revision: 5,
      target: { parentId: "stack-1", slotId: "content", index: 1 },
      rect: RECT,
      focusToken: "insert-menu:x",
    });
    for (const post of posts) expect(post.targetOrigin).toBe(ORIGIN);
  });

  it("routes an inbound restore-focus to onRestoreFocus WITHOUT touching state/onState", () => {
    const { client, onState, onRestoreFocus, fromParent } = setup();
    fromParent(renderMessage(1, SAMPLE_DOCUMENT, EDIT));
    onState.mockClear();

    fromParent(restoreFocusMessage("node-menu:box-1"));

    expect(onRestoreFocus).toHaveBeenCalledWith("node-menu:box-1");
    expect(onState).not.toHaveBeenCalled();
    // The revision on screen is untouched — restore-focus is not a snapshot.
    expect(client.state.revision).toBe(1);
  });

  it("reports an error with a null revision before the first snapshot", () => {
    const { client, posts } = setup();
    client.emitError("bridge is confused");
    expect(posts[0]!.message).toMatchObject({
      type: "error",
      revision: null,
      message: "bridge is confused",
      recoverable: true,
    });
  });

  it("a session-only mode message keeps the document and advances the revision", () => {
    const { client, fromParent } = setup();
    fromParent(renderMessage(1, SAMPLE_DOCUMENT, EDIT));
    fromParent(modeMessage(2, { mode: "preview", theme: "dark", selectedId: "split-1" }));
    expect(client.state.document).toEqual(SAMPLE_DOCUMENT);
    expect(client.state.session).toEqual({
      mode: "preview",
      theme: "dark",
      selectedId: "split-1",
    });
  });

  it("stops listening after dispose", () => {
    const { client, onState, fromParent } = setup();
    client.dispose();
    fromParent(renderMessage(0, SAMPLE_DOCUMENT, EDIT));
    expect(onState).not.toHaveBeenCalled();
  });
});
