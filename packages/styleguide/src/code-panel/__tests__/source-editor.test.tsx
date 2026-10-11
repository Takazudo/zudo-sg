// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { describe, expect, it, vi } from "vitest";
import SourceEditor from "../source-editor.js";

const editor = vi.hoisted(() => {
  let resolve!: () => void;
  const ready = new Promise<void>((done) => { resolve = done; });
  return { ready, resolve, create: vi.fn(), destroy: vi.fn() };
});
vi.mock("../editor-setup.js", async () => {
  await editor.ready;
  return { createEditorView: editor.create };
});

describe("SourceEditor lifecycle and accessible fallback", () => {
  it("ignores an import that resolves after disposal", async () => {
    const island = renderIsland(SourceEditor, { value: "const a = 1;", language: "tsx" as const });
    const host = island.container.firstElementChild!;
    island.dispose();
    const html = host.innerHTML;
    editor.resolve();
    await import("../editor-setup.js");
    await flushAll();
    expect(editor.create).not.toHaveBeenCalled();
    expect(host.innerHTML).toBe(html);
  });

  it("labels the SSR fallback, creates one editor, then destroys it", async () => {
    editor.create.mockImplementation((_value, host) => {
      host.textContent = "Mounted editor";
      return { destroy: editor.destroy };
    });
    const island = renderIsland(SourceEditor, {
      value: "const a = 1;", language: "tsx" as const, label: "Source code for Card: Default",
    });
    expect(island.container.querySelector("pre")).toHaveAttribute("aria-label", "Source code for Card: Default");
    await vi.waitFor(() => expect(editor.create).toHaveBeenCalledTimes(1));
    await island.flush();
    expect(island.container.querySelector("pre")).toBeNull();
    expect(island.container.textContent).toBe("Mounted editor");
    expect(editor.create.mock.calls[0]?.[2]).toMatchObject({ language: "tsx" as const, editable: false, label: "Source code for Card: Default" });
    island.dispose();
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it("omits the fallback label when no label is provided", () => {
    const island = renderIsland(SourceEditor, { value: "const a = 1;", language: "tsx" as const });
    expect(island.container.querySelector("pre")).not.toHaveAttribute("aria-label");
  });
});
