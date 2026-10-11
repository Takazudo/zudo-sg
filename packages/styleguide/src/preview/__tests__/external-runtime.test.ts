import { describe, expect, it } from "vitest";
import {
  EXTERNAL_RUNTIME_VERSION,
  MSG_RESET_FIXTURE,
  MSG_RUNTIME_ERROR,
  hasExternalRuntimeMarker,
  isExternalRuntimeCapabilities,
  isExternalRuntimeError,
  isExternalRuntimeMessage,
  isExternalRuntimeMessageEvent,
  isJsonValue,
  isNewExternalRuntimeSequence,
  isSerializableProps,
  matchesExternalRuntimeIdentity,
  type ExternalRuntimeIdentity,
} from "../external-runtime.js";
import { isReadyMessage, PROTOCOL_VERSION } from "../messages.js";

const identity: ExternalRuntimeIdentity = {
  slug: "editor", variant: "Default", sessionId: "parent-session", documentId: "frame-document", generation: 0,
};
const envelope = { v: 1, runtimeVersion: EXTERNAL_RUNTIME_VERSION, ...identity, sequence: 0 };
const ready = { ...envelope, type: "sg:ready", capabilities: { fullReset: true } };

describe("serializable external props", () => {
  it("accepts nested JSON, shared references without cycles, and null-prototype maps", () => {
    const shared = { value: 3 };
    expect(isSerializableProps({ text: "</script><img onerror=x>", disabled: false, count: 2, empty: null, list: [shared, shared] })).toBe(true);
    expect(isSerializableProps(Object.assign(Object.create(null), { safe: true }))).toBe(true);
    expect(isJsonValue([1, "two", null])).toBe(true);
  });
  it.each([undefined, NaN, Infinity, -Infinity, BigInt(1), () => 0, Symbol("x"), new Date(), new Map(), new Set()])(
    "rejects a lossy nested value: %s", (value) => expect(isSerializableProps({ value })).toBe(false),
  );
  it("rejects arrays at the props root, cycles, reserved keys and oversized nesting", () => {
    expect(isSerializableProps([])).toBe(false);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(isSerializableProps(cycle)).toBe(false);
    for (const key of ["__proto__", "prototype", "constructor"]) {
      expect(isSerializableProps(JSON.parse(`{"nested":{"${key}":1}}`))).toBe(false);
    }
    let deep: unknown = {};
    for (let i = 0; i < 40; i++) deep = { nested: deep };
    expect(isSerializableProps(deep)).toBe(false);
  });
  it("does not invoke accessors and rejects hidden/symbol properties or sparse arrays", () => {
    let reads = 0;
    expect(isSerializableProps({ get value() { reads++; return 1; } })).toBe(false);
    expect(reads).toBe(0);
    expect(isSerializableProps(Object.defineProperty({}, "hidden", { value: 1 }))).toBe(false);
    expect(isSerializableProps({ [Symbol("hidden")]: 1 })).toBe(false);
    expect(isSerializableProps({ value: new Array(2) })).toBe(false);
    const proxy = Proxy.revocable({}, {});
    proxy.revoke();
    expect(isSerializableProps(proxy.proxy)).toBe(false);
  });
});

describe("external-runtime extension", () => {
  it("leaves legacy and explicit v1 readiness valid while requiring an explicit strict marker", () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(isReadyMessage({ type: "sg:ready" })).toBe(true);
    expect(isReadyMessage({ type: "sg:ready", v: 1 })).toBe(true);
    expect(isExternalRuntimeMessage({ type: "sg:ready", v: 1 })).toBe(false);
    expect(hasExternalRuntimeMarker({ type: "sg:ready", runtimeVersion: "broken" })).toBe(true);
    expect(isExternalRuntimeMessage({ ...ready, runtimeVersion: "broken" })).toBe(false);
    expect(isExternalRuntimeMessage({ ...ready, runtimeVersion: 2 })).toBe(false);
    expect(isExternalRuntimeMessage({ ...ready, v: undefined })).toBe(false);
  });
  it("accepts all strict message shapes and a document-independent readiness challenge", () => {
    const challenge = { type: "sg:requestReady", v: 1, runtimeVersion: 1, slug: "editor", variant: "Default", sessionId: "s" };
    expect(isExternalRuntimeMessage(challenge)).toBe(true);
    expect(isExternalRuntimeMessage({ ...challenge, documentId: "old" })).toBe(false);
    for (const message of [
      ready,
      { ...envelope, type: "sg:height", height: 120 },
      { ...envelope, type: "sg:setTheme", theme: "dark" },
      { ...envelope, type: "sg:updateProps", props: { label: "Hello" } },
      { ...envelope, type: MSG_RESET_FIXTURE, nextGeneration: 1 },
      { ...envelope, type: MSG_RUNTIME_ERROR, error: { code: "import", message: "Module unavailable", recoverable: true } },
    ]) expect(isExternalRuntimeMessage(message)).toBe(true);
  });
  it.each([
    { documentId: "" }, { sessionId: "" }, { slug: " " }, { variant: 4 },
    { generation: -1 }, { generation: 0.5 }, { sequence: Number.MAX_SAFE_INTEGER + 1 },
    { sequence: NaN }, { sequence: -1 }, { capabilities: { fullReset: "true" } },
  ])("rejects malformed strict fields %j", (fields) => {
    expect(isExternalRuntimeMessage({ ...ready, ...fields })).toBe(false);
  });
  it("rejects nonserializable props, unresolved themes, invalid heights and reset jumps", () => {
    expect(isExternalRuntimeMessage({ ...envelope, type: "sg:updateProps", props: { callback() {} } })).toBe(false);
    expect(isExternalRuntimeMessage({ ...envelope, type: "sg:setTheme", theme: "auto" })).toBe(false);
    for (const height of [NaN, Infinity, -1]) expect(isExternalRuntimeMessage({ ...envelope, type: "sg:height", height })).toBe(false);
    for (const nextGeneration of [0, 2, 0.5, Infinity]) {
      expect(isExternalRuntimeMessage({ ...envelope, type: MSG_RESET_FIXTURE, nextGeneration })).toBe(false);
    }
  });
  it("uses closed capability/error shapes with safe text messages", () => {
    expect(isExternalRuntimeCapabilities({ fullReset: false })).toBe(true);
    expect(isExternalRuntimeCapabilities({ fullReset: true, unknown: true })).toBe(false);
    expect(isExternalRuntimeError({ code: "render", message: "<script>text only</script>", recoverable: true })).toBe(true);
    for (const error of [{ code: "other", message: "oops", recoverable: true }, { code: "render", message: "", recoverable: true }, new Error("oops")]) {
      expect(isExternalRuntimeError(error)).toBe(false);
    }
  });
});

describe("strict transport and replay guards", () => {
  it("requires exact non-null origin and source window", () => {
    const source = {};
    const expected = { origin: "https://example.test", source };
    const event = { ...expected, data: ready };
    expect(isExternalRuntimeMessageEvent(event, expected)).toBe(true);
    expect(isExternalRuntimeMessageEvent({ ...event, source: {} }, expected)).toBe(false);
    expect(isExternalRuntimeMessageEvent({ ...event, origin: "https://other.test" }, expected)).toBe(false);
    expect(isExternalRuntimeMessageEvent({ ...event, source: null }, { ...expected, source: null })).toBe(false);
    expect(isExternalRuntimeMessageEvent({ ...event, origin: "null" }, { ...expected, origin: "null" })).toBe(false);
  });
  it("compares every fixture/document/session/generation field", () => {
    expect(matchesExternalRuntimeIdentity(identity, { ...identity })).toBe(true);
    for (const field of ["slug", "variant", "sessionId", "documentId"] as const) {
      expect(matchesExternalRuntimeIdentity({ ...identity, [field]: "stale" }, identity)).toBe(false);
    }
    expect(matchesExternalRuntimeIdentity({ ...identity, generation: 1 }, identity)).toBe(false);
  });
  it("rejects replayed/out-of-order sequences without retaining any mutable watermark", () => {
    expect(isNewExternalRuntimeSequence(0, -1)).toBe(true);
    expect(isNewExternalRuntimeSequence(4, 3)).toBe(true);
    for (const candidate of [2, 3, NaN, Infinity, 4.2, Number.MAX_SAFE_INTEGER + 1]) {
      expect(isNewExternalRuntimeSequence(candidate, 3)).toBe(false);
    }
    // A malformed high-sequence envelope cannot mutate this pure check.
    expect(isExternalRuntimeMessage({ ...ready, sequence: 100, generation: "bad" })).toBe(false);
    expect(isNewExternalRuntimeSequence(4, 3)).toBe(true);
  });
});
