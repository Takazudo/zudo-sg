import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_DOCUMENT, createSampleDocument } from "@/composer";
import {
  buildComposerPreviewUrl,
  composerPreviewFrameProps,
  createComposerPreviewBridge,
  type PreviewFrameLike,
} from "../bridge";
import { COMPOSER_PREVIEW_IFRAME_TITLE } from "../route";
import {
  errorMessage,
  readyMessage,
  requestAddMessage,
  requestInsertMenuMessage,
  requestNodeMenuMessage,
  selectMessage,
  type MessageEventLike,
  type MessageTarget,
  type PreviewSession,
  type SerializedRect,
} from "../protocol";

const RECT: SerializedRect = { x: 3, y: 4, width: 50, height: 16 };

const ORIGIN = "https://sg.example.com";
const LOCATION = { src: "/composer/preview", targetOrigin: ORIGIN };
const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };

/** A fake host window: real listener plumbing, no DOM, no MessageEvent quirks. */
function fakeHostWindow(): MessageTarget & { deliver(event: MessageEventLike): void } {
  const listeners = new Set<(event: MessageEventLike) => void>();
  return {
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
    deliver: (event) => {
      for (const listener of [...listeners]) listener(event);
    },
  };
}

/** A fake iframe whose contentWindow records what it was posted, and to where. */
function fakeFrame() {
  const posts: { message: unknown; targetOrigin: string }[] = [];
  const contentWindow = {
    postMessage: (message: unknown, targetOrigin: string) => {
      posts.push({ message, targetOrigin });
    },
  };
  const frame: PreviewFrameLike = { contentWindow };
  return { frame, contentWindow, posts };
}

type PostedRender = { type: string; revision: number; document: { name: string } };

describe("buildComposerPreviewUrl — root base", () => {
  it("builds the route URL and derives the EXACT target origin from it", () => {
    const location = buildComposerPreviewUrl(ORIGIN);
    expect(location.src).toBe("/composer/preview");
    expect(location.targetOrigin).toBe(ORIGIN);
  });

  it("never yields a wildcard target origin", () => {
    expect(buildComposerPreviewUrl("http://localhost:4321").targetOrigin).toBe(
      "http://localhost:4321",
    );
    expect(buildComposerPreviewUrl(ORIGIN).targetOrigin).not.toBe("*");
  });

  it("throws rather than guessing when there is no document origin", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "location");
    // @ts-expect-error — deliberately removing `location` to model a non-browser context.
    delete globalThis.location;
    try {
      expect(() => buildComposerPreviewUrl()).toThrow(/document origin/);
    } finally {
      if (original) Object.defineProperty(globalThis, "location", original);
    }
  });
});

describe("composerPreviewFrameProps — the host seam", () => {
  it("supplies an accessible title and a locked-down sandbox", () => {
    const props = composerPreviewFrameProps(buildComposerPreviewUrl(ORIGIN));
    expect(props.title).toBe(COMPOSER_PREVIEW_IFRAME_TITLE);
    expect(props.title.length).toBeGreaterThan(0);
    expect(props.sandbox).toBe("allow-same-origin allow-scripts");
    expect(props.src).toBe("/composer/preview");
  });
});

describe("createComposerPreviewBridge — readiness + replay", () => {
  let host: ReturnType<typeof fakeHostWindow>;
  let iframe: ReturnType<typeof fakeFrame>;

  beforeEach(() => {
    host = fakeHostWindow();
    iframe = fakeFrame();
  });

  function bridgeWith(overrides: Record<string, unknown> = {}) {
    return createComposerPreviewBridge({
      frame: iframe.frame,
      location: LOCATION,
      hostWindow: host,
      ...overrides,
    });
  }

  function ready(source: unknown = iframe.contentWindow, origin = ORIGIN): void {
    host.deliver({ data: readyMessage(), origin, source });
  }

  it("holds a snapshot until the iframe is ready, then sends it", () => {
    const bridge = bridgeWith();
    bridge.render(SAMPLE_DOCUMENT, EDIT);
    expect(iframe.posts).toHaveLength(0);
    expect(bridge.ready).toBe(false);

    ready();
    expect(bridge.ready).toBe(true);
    expect(iframe.posts).toHaveLength(1);
    expect(iframe.posts[0]!.targetOrigin).toBe(ORIGIN);
  });

  it("ALWAYS posts to the exact target origin, never '*'", () => {
    const bridge = bridgeWith();
    ready();
    bridge.render(SAMPLE_DOCUMENT, EDIT);
    bridge.updateSession({ mode: "preview", theme: "dark", selectedId: null });
    expect(iframe.posts.length).toBeGreaterThan(0);
    for (const post of iframe.posts) expect(post.targetOrigin).toBe(ORIGIN);
  });

  it("replays ONLY the newest snapshot when a late iframe becomes ready", () => {
    const bridge = bridgeWith();
    const older = createSampleDocument();
    older.name = "older";
    const newest = createSampleDocument();
    newest.name = "newest";

    bridge.render(older, EDIT);
    bridge.render(newest, EDIT);
    expect(iframe.posts).toHaveLength(0);

    ready();
    expect(iframe.posts).toHaveLength(1);
    const posted = iframe.posts[0]!.message as PostedRender;
    expect(posted.type).toBe("render");
    expect(posted.document.name).toBe("newest");
  });

  it("on RELOAD (a second ready) replays the newest snapshot — never an older one", () => {
    const bridge = bridgeWith();
    ready();

    const first = createSampleDocument();
    first.name = "first";
    bridge.render(first, EDIT);

    const second = createSampleDocument();
    second.name = "second";
    const lastSent = bridge.render(second, EDIT);

    iframe.posts.length = 0;

    // The iframe reloads and re-announces itself.
    ready();

    expect(iframe.posts).toHaveLength(1);
    const replayed = iframe.posts[0]!.message as PostedRender;
    expect(replayed.document.name).toBe("second");
    // The replay mints a FRESH revision — strictly newer than anything the
    // (possibly reloaded) iframe can already have applied. See
    // reload-replay.test.ts for why that is load-bearing, not cosmetic.
    expect(replayed.revision).toBeGreaterThan(lastSent);
    expect(replayed.revision).toBe(bridge.revision);
  });

  it("mints strictly increasing revisions", () => {
    const bridge = bridgeWith();
    ready();
    const a = bridge.render(SAMPLE_DOCUMENT, EDIT);
    const b = bridge.updateSession({ mode: "preview", theme: "light", selectedId: null });
    const c = bridge.render(SAMPLE_DOCUMENT, EDIT);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(a).toBeGreaterThanOrEqual(0);
  });

  it("restoreFocus posts a restore-focus message once ready, to the exact origin", () => {
    const bridge = bridgeWith();
    bridge.restoreFocus("node-menu:box-1");
    expect(iframe.posts).toHaveLength(0); // not ready yet — silently dropped, not queued

    ready();
    iframe.posts.length = 0;
    bridge.restoreFocus("node-menu:box-1");
    expect(iframe.posts).toHaveLength(1);
    expect(iframe.posts[0]!.message).toMatchObject({ type: "restore-focus", focusToken: "node-menu:box-1" });
    expect(iframe.posts[0]!.targetOrigin).toBe(ORIGIN);
  });

  it("a session change made before ready is carried by the replay", () => {
    const bridge = bridgeWith();
    bridge.render(SAMPLE_DOCUMENT, EDIT);
    bridge.updateSession({ mode: "preview", theme: "dark", selectedId: "split-1" });
    expect(iframe.posts).toHaveLength(0);

    ready();
    expect(iframe.posts).toHaveLength(1);
    const posted = iframe.posts[0]!.message as { type: string; session: PreviewSession };
    expect(posted.type).toBe("render");
    expect(posted.session).toEqual({ mode: "preview", theme: "dark", selectedId: "split-1" });
  });
});

describe("createComposerPreviewBridge — inbound guard", () => {
  it("routes select / request-add / request-node-menu / request-insert-menu / error to their handlers", () => {
    const host = fakeHostWindow();
    const iframe = fakeFrame();
    const onSelect = vi.fn();
    const onRequestAdd = vi.fn();
    const onRequestNodeMenu = vi.fn();
    const onRequestInsertMenu = vi.fn();
    const onError = vi.fn();
    createComposerPreviewBridge({
      frame: iframe.frame,
      location: LOCATION,
      hostWindow: host,
      onSelect,
      onRequestAdd,
      onRequestNodeMenu,
      onRequestInsertMenu,
      onError,
    });

    const source = iframe.contentWindow;
    host.deliver({ data: selectMessage(2, "prose-1"), origin: ORIGIN, source });
    host.deliver({
      data: requestAddMessage(2, { parentId: "stack-1", slotId: "content", index: 1 }),
      origin: ORIGIN,
      source,
    });
    host.deliver({ data: requestNodeMenuMessage(2, "box-1", RECT, "node-menu:box-1"), origin: ORIGIN, source });
    host.deliver({
      data: requestInsertMenuMessage(2, { parentId: "stack-1", slotId: "content", index: 1 }, RECT, "insert-menu:x"),
      origin: ORIGIN,
      source,
    });
    host.deliver({ data: errorMessage(2, "node threw", true), origin: ORIGIN, source });

    expect(onSelect).toHaveBeenCalledWith("prose-1", 2);
    expect(onRequestAdd).toHaveBeenCalledWith(
      { parentId: "stack-1", slotId: "content", index: 1 },
      2,
    );
    expect(onRequestNodeMenu).toHaveBeenCalledWith("box-1", RECT, "node-menu:box-1", 2);
    expect(onRequestInsertMenu).toHaveBeenCalledWith(
      { parentId: "stack-1", slotId: "content", index: 1 },
      RECT,
      "insert-menu:x",
      2,
    );
    expect(onError).toHaveBeenCalledWith("node threw", true, 2);
  });

  it("DROPS messages from a foreign window or a foreign origin", () => {
    const host = fakeHostWindow();
    const iframe = fakeFrame();
    const onSelect = vi.fn();
    const onReady = vi.fn();
    const onRejected = vi.fn();
    const bridge = createComposerPreviewBridge({
      frame: iframe.frame,
      location: LOCATION,
      hostWindow: host,
      onSelect,
      onReady,
      onRejected,
    });

    host.deliver({ data: readyMessage(), origin: ORIGIN, source: { evil: true } });
    host.deliver({ data: readyMessage(), origin: "https://evil.example.com", source: iframe.contentWindow });
    host.deliver({ data: { type: "select", nodeId: "x" }, origin: ORIGIN, source: iframe.contentWindow });

    expect(onReady).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(bridge.ready).toBe(false);
    expect(onRejected.mock.calls.map((call) => call[0])).toEqual([
      "wrong-source",
      "wrong-origin",
      "invalid-payload",
    ]);
  });

  it("stops listening after dispose", () => {
    const host = fakeHostWindow();
    const iframe = fakeFrame();
    const onReady = vi.fn();
    const bridge = createComposerPreviewBridge({
      frame: iframe.frame,
      location: LOCATION,
      hostWindow: host,
      onReady,
    });
    bridge.dispose();
    host.deliver({ data: readyMessage(), origin: ORIGIN, source: iframe.contentWindow });
    expect(onReady).not.toHaveBeenCalled();
  });
});

describe("createComposerPreviewBridge — instance scoping (wave 6 / #254)", () => {
  it("two simultaneous previews keep separate readiness, revisions, and snapshots", () => {
    // One shared host window, two iframes — exactly the canvas + chooser setup.
    const host = fakeHostWindow();
    const canvas = fakeFrame();
    const chooser = fakeFrame();

    const canvasBridge = createComposerPreviewBridge({
      frame: canvas.frame,
      location: LOCATION,
      hostWindow: host,
    });
    const chooserBridge = createComposerPreviewBridge({
      frame: chooser.frame,
      location: LOCATION,
      hostWindow: host,
    });

    const canvasDoc = createSampleDocument();
    canvasDoc.name = "canvas";
    const chooserDoc = createSampleDocument();
    chooserDoc.name = "chooser";

    canvasBridge.render(canvasDoc, EDIT);
    chooserBridge.render(chooserDoc, EDIT);

    // Only the canvas iframe reports ready.
    host.deliver({ data: readyMessage(), origin: ORIGIN, source: canvas.contentWindow });

    expect(canvasBridge.ready).toBe(true);
    expect(chooserBridge.ready).toBe(false);
    expect(canvas.posts).toHaveLength(1);
    expect(chooser.posts).toHaveLength(0);
    expect((canvas.posts[0]!.message as PostedRender).document.name).toBe("canvas");

    // Now the chooser boots; it gets its OWN document, not the canvas's.
    host.deliver({ data: readyMessage(), origin: ORIGIN, source: chooser.contentWindow });
    expect(chooser.posts).toHaveLength(1);
    expect((chooser.posts[0]!.message as PostedRender).document.name).toBe("chooser");
    // And the canvas was not re-sent anything by the chooser's ready.
    expect(canvas.posts).toHaveLength(1);
  });

  it("each bridge counts its own revisions", () => {
    const host = fakeHostWindow();
    const a = fakeFrame();
    const b = fakeFrame();
    const bridgeA = createComposerPreviewBridge({
      frame: a.frame,
      location: LOCATION,
      hostWindow: host,
    });
    const bridgeB = createComposerPreviewBridge({
      frame: b.frame,
      location: LOCATION,
      hostWindow: host,
    });

    bridgeA.render(SAMPLE_DOCUMENT, EDIT);
    bridgeA.render(SAMPLE_DOCUMENT, EDIT);
    bridgeA.render(SAMPLE_DOCUMENT, EDIT);
    expect(bridgeA.revision).toBe(2);
    expect(bridgeB.revision).toBe(-1);

    expect(bridgeB.render(SAMPLE_DOCUMENT, EDIT)).toBe(0);
  });
});
