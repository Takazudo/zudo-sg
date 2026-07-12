import { describe, expect, it } from "vitest";
import { SAMPLE_DOCUMENT } from "@/composer";
import {
  COMPOSER_PREVIEW_CHANNEL,
  COMPOSER_PREVIEW_PROTOCOL_VERSION,
  modeMessage,
  readParentToPreview,
  readPreviewToParent,
  readyMessage,
  renderMessage,
  requestAddMessage,
  selectMessage,
  errorMessage,
  type MessageEventLike,
  type PreviewSession,
} from "../protocol";

const PARENT = { name: "parent-window" };
const ORIGIN = "https://sg.example.com";
const EXPECTED = { source: PARENT, origin: ORIGIN };

const SESSION: PreviewSession = { mode: "edit", theme: "light", selectedId: null };

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
      errorMessage(null, "boom"),
    ];
    for (const message of messages) {
      expect(message.channel).toBe(COMPOSER_PREVIEW_CHANNEL);
      expect(message.v).toBe(COMPOSER_PREVIEW_PROTOCOL_VERSION);
    }
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
});

describe("readPreviewToParent", () => {
  const IFRAME = { name: "iframe-window" };
  const FROM_IFRAME = { source: IFRAME, origin: ORIGIN };

  it("accepts ready / select / request-add / error", () => {
    const target = { parentId: "stack-1", slotId: "content", index: 2 };
    const messages = [
      readyMessage(),
      selectMessage(1, "prose-1"),
      selectMessage(1, null),
      requestAddMessage(1, target),
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
});
