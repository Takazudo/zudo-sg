import { describe, expect, it } from "vitest";
import {
  MSG_HEIGHT,
  MSG_READY,
  MSG_REQUEST_READY,
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
  PROTOCOL_VERSION,
  isHeightMessage,
  isReadyMessage,
  isRequestReadyMessage,
  isSetThemeMessage,
  isSupportedProtocolVersion,
  isUpdatePropsMessage,
  matchesPreviewIdentity,
} from "../messages.js";

describe("isRequestReadyMessage", () => {
  it("accepts the parent readiness probe", () => {
    expect(isRequestReadyMessage({ type: MSG_REQUEST_READY })).toBe(true);
    expect(isRequestReadyMessage({ type: MSG_READY })).toBe(false);
    expect(isRequestReadyMessage(null)).toBe(false);
  });
});

describe("isSetThemeMessage", () => {
  it.each(["light", "dark"] as const)(
    "accepts a well-formed %s theme envelope",
    (theme) => {
      expect(isSetThemeMessage({ type: MSG_SET_THEME, theme })).toBe(true);
    },
  );

  it.each([
    ["wrong type", { type: "sg:other", theme: "light" }],
    ["missing theme", { type: MSG_SET_THEME }],
    ["non-string theme", { type: MSG_SET_THEME, theme: 1 }],
    ["unresolved auto theme", { type: MSG_SET_THEME, theme: "auto" }],
  ])("rejects a malformed envelope with %s", (_description, value) => {
    expect(isSetThemeMessage(value)).toBe(false);
  });
});

describe("isReadyMessage", () => {
  it("accepts only the ready message type", () => {
    expect(isReadyMessage({ type: MSG_READY })).toBe(true);
    expect(isReadyMessage({ type: "sg:other" })).toBe(false);
    expect(isReadyMessage(null)).toBe(false);
  });
});

describe("protocol version (v1)", () => {
  it("exports protocol version 1", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  const cases: Array<[string, (value: unknown) => boolean, Record<string, unknown>]> = [
    ["isRequestReadyMessage", isRequestReadyMessage, { type: MSG_REQUEST_READY }],
    ["isReadyMessage", isReadyMessage, { type: MSG_READY }],
    ["isHeightMessage", isHeightMessage, { type: MSG_HEIGHT, height: 120 }],
    ["isSetThemeMessage", isSetThemeMessage, { type: MSG_SET_THEME, theme: "dark" }],
    ["isUpdatePropsMessage", isUpdatePropsMessage, { type: MSG_UPDATE_PROPS, props: {} }],
  ];

  it.each(cases)("%s accepts v: 1", (_name, guard, message) => {
    expect(guard({ ...message, v: 1 })).toBe(true);
  });

  it.each(cases)("%s accepts a legacy message with no v", (_name, guard, message) => {
    expect(guard(message)).toBe(true);
  });

  it.each(cases)("%s rejects v: 2 and a non-numeric v", (_name, guard, message) => {
    expect(guard({ ...message, v: 2 })).toBe(false);
    expect(guard({ ...message, v: "1" })).toBe(false);
  });

  it("isSupportedProtocolVersion rejects non-objects", () => {
    expect(isSupportedProtocolVersion(null)).toBe(false);
    expect(isSupportedProtocolVersion("sg:ready")).toBe(false);
    expect(isSupportedProtocolVersion({})).toBe(true);
  });
});

describe("frame identity", () => {
  it("accepts ready and height messages that carry a string identity", () => {
    expect(
      isReadyMessage({ type: MSG_READY, v: 1, slug: "button", variant: "Primary" }),
    ).toBe(true);
    expect(
      isHeightMessage({ type: MSG_HEIGHT, v: 1, height: 1, slug: "button", variant: "Primary" }),
    ).toBe(true);
  });

  it("rejects a malformed identity", () => {
    expect(isReadyMessage({ type: MSG_READY, slug: 1 })).toBe(false);
    expect(isHeightMessage({ type: MSG_HEIGHT, height: 1, variant: {} })).toBe(false);
  });

  it("matches only the current identity, and treats a missing identity as legacy", () => {
    const current = { slug: "button", variant: "Primary" };
    expect(matchesPreviewIdentity({ slug: "button", variant: "Primary" }, current)).toBe(true);
    expect(matchesPreviewIdentity({}, current)).toBe(true);
    expect(matchesPreviewIdentity({ slug: "button" }, current)).toBe(true);
    expect(matchesPreviewIdentity({ slug: "card", variant: "Primary" }, current)).toBe(false);
    expect(matchesPreviewIdentity({ slug: "button", variant: "Ghost" }, current)).toBe(false);
  });
});
