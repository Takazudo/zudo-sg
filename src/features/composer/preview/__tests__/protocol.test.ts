import { describe, expect, it } from "vitest";
import { SAMPLE_DOCUMENT } from "@/composer";
import {
  COMPOSER_PREVIEW_CHANNEL,
  COMPOSER_PREVIEW_PROTOCOL_VERSION,
  RESERVED_PROP_KEYS,
  commitInlineEditMessage,
  modeMessage,
  readParentToPreview,
  readPreviewToParent,
  readyMessage,
  renderMessage,
  requestAddMessage,
  requestInsertMenuMessage,
  requestNodeMenuMessage,
  restoreFocusMessage,
  selectMessage,
  serializeRect,
  errorMessage,
  type MessageEventLike,
  type PreviewSession,
  type SerializedRect,
} from "../protocol";

const PARENT = { name: "parent-window" };
const ORIGIN = "https://sg.example.com";
const EXPECTED = { source: PARENT, origin: ORIGIN };

const SESSION: PreviewSession = { mode: "edit", theme: "light", selectedId: null };
const RECT: SerializedRect = { x: 10, y: 20, width: 100, height: 24 };

function event(data: unknown, over: Partial<MessageEventLike> = {}): MessageEventLike {
  return { data, origin: ORIGIN, source: PARENT, ...over };
}

describe("protocol envelope", () => {
  it("stamps channel + version on every constructed message", () => {
    const messages = [
      renderMessage(0, SAMPLE_DOCUMENT, SESSION),
      modeMessage(1, SESSION),
      readyMessage(),
      selectMessage(2, "split-1"),
      requestAddMessage(3, { parentId: null, slotId: "root", index: 0 }),
      requestNodeMenuMessage(3, "box-1", RECT, "node-menu:box-1"),
      requestInsertMenuMessage(3, { parentId: null, slotId: "root", index: 0 }, RECT, "insert-menu::root:0"),
      restoreFocusMessage("node-menu:box-1"),
      commitInlineEditMessage("prose-1", "children", "Edited copy", 3),
      errorMessage(null, "boom"),
    ];
    for (const message of messages) {
      expect(message.channel).toBe(COMPOSER_PREVIEW_CHANNEL);
      expect(message.v).toBe(COMPOSER_PREVIEW_PROTOCOL_VERSION);
    }
  });
});

describe("serializeRect", () => {
  it("extracts x/y/width/height from any DOMRect-like value", () => {
    // DOMRect's own fields are prototype accessors, not own-enumerable
    // properties — so this simulates the exact hazard: a bare spread of a
    // real DOMRect would lose everything, but property ACCESS still works.
    const rect = { x: 1, y: 2, width: 3, height: 4, top: 2, left: 1, bottom: 6, right: 4 };
    expect(serializeRect(rect)).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});

describe("readParentToPreview — the security gate", () => {
  it("accepts a well-formed render from the expected source + origin", () => {
    const result = readParentToPreview(event(renderMessage(0, SAMPLE_DOCUMENT, SESSION)), EXPECTED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message.type).toBe("render");
    expect(result.message.revision).toBe(0);
  });

  it("accepts a session-only mode message", () => {
    const result = readParentToPreview(
      event(modeMessage(4, { mode: "preview", theme: "dark", selectedId: "split-1" })),
      EXPECTED,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message.type).toBe("mode");
  });

  it("accepts a host→preview restore-focus response (issue #256, not revision-stamped)", () => {
    const result = readParentToPreview(event(restoreFocusMessage("node-menu:box-1")), EXPECTED);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toEqual({
      channel: COMPOSER_PREVIEW_CHANNEL,
      v: COMPOSER_PREVIEW_PROTOCOL_VERSION,
      type: "restore-focus",
      focusToken: "node-menu:box-1",
    });
  });

  it("REJECTS a restore-focus with an empty focusToken", () => {
    const result = readParentToPreview(
      event({ ...restoreFocusMessage("x"), focusToken: "" }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a message from the wrong source window", () => {
    const foreign = { name: "some-other-frame" };
    const result = readParentToPreview(
      event(renderMessage(0, SAMPLE_DOCUMENT, SESSION), { source: foreign }),
      EXPECTED,
    );
    expect(result).toEqual({ ok: false, reason: "wrong-source" });
  });

  it("REJECTS a message from the wrong origin even with the right source", () => {
    const result = readParentToPreview(
      event(renderMessage(0, SAMPLE_DOCUMENT, SESSION), { origin: "https://evil.example.com" }),
      EXPECTED,
    );
    expect(result).toEqual({ ok: false, reason: "wrong-origin" });
  });

  it("REJECTS when the expected source is unresolved (a null contentWindow)", () => {
    const result = readParentToPreview(event(readyMessage(), { source: null }), {
      source: null,
      origin: ORIGIN,
    });
    expect(result).toEqual({ ok: false, reason: "wrong-source" });
  });

  it("REJECTS a payload carrying an EXTRA key (strict schema)", () => {
    const smuggled = {
      ...renderMessage(0, SAMPLE_DOCUMENT, SESSION),
      component: "() => {}",
    };
    const result = readParentToPreview(event(smuggled), EXPECTED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid-payload");
  });

  it("REJECTS a node carrying an extra key inside the document", () => {
    const document = {
      ...SAMPLE_DOCUMENT,
      root: [{ ...SAMPLE_DOCUMENT.root[0], adapters: { render: "nope" } }],
    };
    const result = readParentToPreview(
      event({ ...renderMessage(0, SAMPLE_DOCUMENT, SESSION), document }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid-payload");
  });

  it("REJECTS an unknown message type", () => {
    const result = readParentToPreview(
      event({
        channel: COMPOSER_PREVIEW_CHANNEL,
        v: COMPOSER_PREVIEW_PROTOCOL_VERSION,
        type: "eval",
        code: "alert(1)",
      }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid-payload");
  });

  it("REJECTS a foreign channel (the styleguide's sg:* bus shares this window)", () => {
    const result = readParentToPreview(
      event({ type: "sg:updateProps", props: {} }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a future protocol version rather than misreading it", () => {
    const result = readParentToPreview(
      event({ ...renderMessage(0, SAMPLE_DOCUMENT, SESSION), v: 2 }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a non-integer / negative revision", () => {
    for (const revision of [-1, 1.5, Number.NaN, "3"]) {
      const result = readParentToPreview(
        event({ ...renderMessage(0, SAMPLE_DOCUMENT, SESSION), revision }),
        EXPECTED,
      );
      expect(result.ok, `revision ${String(revision)} must be rejected`).toBe(false);
    }
  });

  it("REJECTS a document of an unsupported schema version", () => {
    const result = readParentToPreview(
      event({
        ...renderMessage(0, SAMPLE_DOCUMENT, SESSION),
        document: { ...SAMPLE_DOCUMENT, schemaVersion: 99 },
      }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS non-JSON-safe props (a function cannot cross the bridge)", () => {
    const document = {
      ...SAMPLE_DOCUMENT,
      root: [{ ...SAMPLE_DOCUMENT.root[0], props: { onClick: () => undefined } }],
    };
    const result = readParentToPreview(
      event({ ...renderMessage(0, SAMPLE_DOCUMENT, SESSION), document }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a bare string / null payload without throwing", () => {
    for (const data of ["render", null, undefined, 42, []]) {
      expect(readParentToPreview(event(data), EXPECTED).ok).toBe(false);
    }
  });

  // JSON-safe is NOT the same as safe. `dangerouslySetInnerHTML` is perfectly
  // JSON-safe, and cohort components spread their rest props onto real DOM nodes
  // (ProseP renders `<p {...rest} />`) — inside a document that is SAME-ORIGIN
  // with /composer. These keys are refused at the boundary.
  it.each([...RESERVED_PROP_KEYS])("REJECTS a node prop named %s", (reserved) => {
    const document = {
      ...SAMPLE_DOCUMENT,
      root: [
        {
          ...SAMPLE_DOCUMENT.root[0],
          props: { ...SAMPLE_DOCUMENT.root[0]!.props, [reserved]: "x" },
        },
      ],
    };
    const result = readParentToPreview(
      event({ ...renderMessage(0, SAMPLE_DOCUMENT, SESSION), document }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid-payload");
  });

  it("REJECTS a dangerouslySetInnerHTML payload nested deep in the tree", () => {
    const document = {
      ...SAMPLE_DOCUMENT,
      root: [
        {
          ...SAMPLE_DOCUMENT.root[0]!,
          slots: {
            left: [
              {
                id: "evil-1",
                componentId: "ui.prose-p",
                componentVersion: 1,
                props: { dangerouslySetInnerHTML: { __html: "<img src=x onerror=alert(1)>" } },
                slots: {},
              },
            ],
          },
        },
      ],
    };
    const result = readParentToPreview(
      event({ ...renderMessage(0, SAMPLE_DOCUMENT, SESSION), document }),
      EXPECTED,
    );
    expect(result.ok).toBe(false);
  });
});

describe("readPreviewToParent", () => {
  const IFRAME = { name: "iframe-window" };
  const FROM_IFRAME = { source: IFRAME, origin: ORIGIN };

  it("accepts ready / select / request-add / request-node-menu / request-insert-menu / error", () => {
    const target = { parentId: "stack-1", slotId: "content", index: 2 };
    const messages = [
      readyMessage(),
      selectMessage(1, "prose-1"),
      selectMessage(1, null),
      requestAddMessage(1, target),
      requestNodeMenuMessage(1, "box-1", RECT, "node-menu:box-1"),
      requestInsertMenuMessage(1, target, RECT, "insert-menu:stack-1:content:2"),
      commitInlineEditMessage("prose-1", "children", "Edited copy", 1),
      errorMessage(1, "component threw", true),
      errorMessage(null, "before the first snapshot", false),
    ];
    for (const message of messages) {
      const result = readPreviewToParent(
        { data: message, origin: ORIGIN, source: IFRAME },
        FROM_IFRAME,
      );
      expect(result.ok, JSON.stringify(message)).toBe(true);
    }
  });

  it("carries the rect + focusToken verbatim on request-node-menu", () => {
    const result = readPreviewToParent(
      { data: requestNodeMenuMessage(4, "box-1", RECT, "node-menu:box-1"), origin: ORIGIN, source: IFRAME },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.message.type !== "request-node-menu") return;
    expect(result.message.nodeId).toBe("box-1");
    expect(result.message.rect).toEqual(RECT);
    expect(result.message.focusToken).toBe("node-menu:box-1");
  });

  it("carries the InsertionTarget + rect + focusToken verbatim on request-insert-menu", () => {
    const target = { parentId: null, slotId: "root", index: 0 };
    const result = readPreviewToParent(
      {
        data: requestInsertMenuMessage(4, target, RECT, "insert-menu::root:0"),
        origin: ORIGIN,
        source: IFRAME,
      },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.message.type !== "request-insert-menu") return;
    expect(result.message.target).toEqual(target);
    expect(result.message.rect).toEqual(RECT);
  });

  it.each([
    ["NaN width", { ...RECT, width: Number.NaN }],
    ["Infinity height", { ...RECT, height: Number.POSITIVE_INFINITY }],
    ["non-numeric x", { ...RECT, x: "10" }],
    ["missing y", { x: RECT.x, width: RECT.width, height: RECT.height }],
  ])("REJECTS a request-node-menu with a malformed/non-finite rect (%s)", (_label, badRect) => {
    const result = readPreviewToParent(
      {
        data: { ...requestNodeMenuMessage(1, "box-1", RECT, "node-menu:box-1"), rect: badRect },
        origin: ORIGIN,
        source: IFRAME,
      },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a request-insert-menu with a malformed/non-finite rect", () => {
    const target = { parentId: null, slotId: "root", index: 0 };
    const result = readPreviewToParent(
      {
        data: {
          ...requestInsertMenuMessage(1, target, RECT, "insert-menu::root:0"),
          rect: { ...RECT, height: Number.NaN },
        },
        origin: ORIGIN,
        source: IFRAME,
      },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a request-insert-menu whose target is not a valid InsertionTarget", () => {
    const result = readPreviewToParent(
      {
        data: {
          ...requestInsertMenuMessage(1, { parentId: null, slotId: "root", index: 0 }, RECT, "t"),
          // An append-only slot ref (no index) is not #245's InsertionTarget shape.
          target: { parentId: null, slotId: "root" },
        },
        origin: ORIGIN,
        source: IFRAME,
      },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS request-node-menu / request-insert-menu with an empty focusToken", () => {
    const target = { parentId: null, slotId: "root", index: 0 };
    expect(
      readPreviewToParent(
        {
          data: { ...requestNodeMenuMessage(1, "box-1", RECT, "x"), focusToken: "" },
          origin: ORIGIN,
          source: IFRAME,
        },
        FROM_IFRAME,
      ).ok,
    ).toBe(false);
    expect(
      readPreviewToParent(
        {
          data: { ...requestInsertMenuMessage(1, target, RECT, "x"), focusToken: "" },
          origin: ORIGIN,
          source: IFRAME,
        },
        FROM_IFRAME,
      ).ok,
    ).toBe(false);
  });

  it("carries #245's InsertionTarget verbatim, including the virtual root", () => {
    const result = readPreviewToParent(
      {
        data: requestAddMessage(3, { parentId: null, slotId: "root", index: 0 }),
        origin: ORIGIN,
        source: IFRAME,
      },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.message.type !== "request-add") return;
    expect(result.message.target).toEqual({ parentId: null, slotId: "root", index: 0 });
  });

  it("REJECTS a request-add with an append-only slot ref (no index)", () => {
    const result = readPreviewToParent(
      {
        data: {
          channel: COMPOSER_PREVIEW_CHANNEL,
          v: COMPOSER_PREVIEW_PROTOCOL_VERSION,
          type: "request-add",
          revision: 1,
          target: { parentId: "stack-1", slotId: "content" },
        },
        origin: ORIGIN,
        source: IFRAME,
      },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a wrong-source / wrong-origin message", () => {
    expect(
      readPreviewToParent({ data: readyMessage(), origin: ORIGIN, source: {} }, FROM_IFRAME),
    ).toEqual({ ok: false, reason: "wrong-source" });
    expect(
      readPreviewToParent(
        { data: readyMessage(), origin: "https://evil.example.com", source: IFRAME },
        FROM_IFRAME,
      ),
    ).toEqual({ ok: false, reason: "wrong-origin" });
  });

  // ── commit-inline-edit (issue #257) ────────────────────────────────────────
  it("carries { nodeId, fieldKey, value, documentRevision } verbatim on commit-inline-edit", () => {
    const result = readPreviewToParent(
      { data: commitInlineEditMessage("prose-1", "children", "Fresh copy", 7), origin: ORIGIN, source: IFRAME },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.message.type !== "commit-inline-edit") return;
    expect(result.message).toMatchObject({
      nodeId: "prose-1",
      fieldKey: "children",
      value: "Fresh copy",
      documentRevision: 7,
    });
  });

  it("accepts an EMPTY value (erasing a field is legitimate)", () => {
    const result = readPreviewToParent(
      { data: commitInlineEditMessage("prose-1", "children", "", 2), origin: ORIGIN, source: IFRAME },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.message.type !== "commit-inline-edit") return;
    expect(result.message.value).toBe("");
  });

  it("preserves newlines in the value (multiline field)", () => {
    const result = readPreviewToParent(
      { data: commitInlineEditMessage("prose-1", "children", "line 1\nline 2", 2), origin: ORIGIN, source: IFRAME },
      FROM_IFRAME,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.message.type !== "commit-inline-edit") return;
    expect(result.message.value).toBe("line 1\nline 2");
  });

  it.each([
    ["empty nodeId", { ...commitInlineEditMessage("x", "children", "v", 1), nodeId: "" }],
    ["empty fieldKey", { ...commitInlineEditMessage("prose-1", "x", "v", 1), fieldKey: "" }],
    ["non-string value", { ...commitInlineEditMessage("prose-1", "children", "v", 1), value: 42 }],
    ["negative documentRevision", { ...commitInlineEditMessage("prose-1", "children", "v", 1), documentRevision: -1 }],
    ["extra key", { ...commitInlineEditMessage("prose-1", "children", "v", 1), smuggled: true }],
  ])("REJECTS a malformed commit-inline-edit (%s)", (_label, data) => {
    const result = readPreviewToParent({ data, origin: ORIGIN, source: IFRAME }, FROM_IFRAME);
    expect(result.ok).toBe(false);
  });
});
