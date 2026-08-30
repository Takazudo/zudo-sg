import { describe, expect, it } from "vitest";
import {
  MSG_READY,
  MSG_REQUEST_READY,
  MSG_SET_THEME,
  isReadyMessage,
  isRequestReadyMessage,
  isSetThemeMessage,
} from "../messages";

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
