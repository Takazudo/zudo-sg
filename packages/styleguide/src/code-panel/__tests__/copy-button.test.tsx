// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { fire, getByRole, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { afterEach, expect, it, vi } from "vitest";
import CopyButton from "../copy-button.js";
import { copyText } from "../copy-text.js";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("hydrates, copies verbatim text, and resets its status", async () => {
  vi.useFakeTimers();
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const island = renderIsland(CopyButton, { text: "const a = 1;", label: "Copy source" });
  fire(getByRole(island.container, "button", { name: "Copy source" }), "click");
  await vi.advanceTimersByTimeAsync(0);
  await island.flush();
  expect(writeText).toHaveBeenCalledWith("const a = 1;");
  expect(getByRole(island.container, "button", { name: "Copied" })).toHaveAttribute("data-copied", "true");
  await vi.advanceTimersByTimeAsync(1400);
  await island.flush();
  expect(getByRole(island.container, "button", { name: "Copy source" })).not.toHaveAttribute("data-copied");
});

it("ignores clipboard completion after disposal", async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => { resolve = done; });
  vi.stubGlobal("navigator", { clipboard: { writeText: () => pending } });
  const island = renderIsland(CopyButton, { text: "source" });
  const button = getByRole(island.container, "button", { name: "Copy" });
  fire(button, "click");
  island.dispose();
  resolve();
  await pending;
  await island.flush();
  expect(button).not.toHaveAttribute("data-copied");
});

it("uses the legacy copy fallback when the clipboard API rejects", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
  const exec = vi.fn().mockReturnValue(true);
  Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
  expect(await copyText("fallback")).toBe(true);
  expect(exec).toHaveBeenCalledWith("copy");
  expect(document.querySelector("textarea")).toBeNull();
  Reflect.deleteProperty(document, "execCommand");
});

it("removes the fallback textarea even when execCommand throws", async () => {
  vi.stubGlobal("navigator", {});
  Object.defineProperty(document, "execCommand", { configurable: true, value: () => { throw new Error("unavailable"); } });
  expect(await copyText("fallback")).toBe(false);
  expect(document.querySelector("textarea")).toBeNull();
  Reflect.deleteProperty(document, "execCommand");
});
