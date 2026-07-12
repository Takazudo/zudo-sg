// Hook-level tests for the clipboard/duplicate foundation (issue #255):
// exercises copy/cut/paste/duplicate through the real `useComposerController`
// public API, including the persistence/status-chip-facing effects the pure
// `controller-model-clipboard.test.ts` suite can't see (localStorage writes,
// `lastError`). See that file for the exhaustive reducer-level cases.

import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/preact";
import { createSequentialIdFactory } from "@/composer";
import { fixtureManifest, makeAbcDocument, resetFixtureIds } from "@/composer/__tests__/fixtures";
import { useComposerController } from "../use-composer-controller";
import { COMPOSER_DOCUMENT_STORAGE_KEY } from "../storage";

function setup() {
  resetFixtureIds();
  // Created OUTSIDE the render callback so the reference is stable across
  // re-renders — `useComposerController` memoizes `idFactory` on
  // `options.idFactory`'s identity, and a factory literal re-created inline in
  // the render callback would get a fresh (reset) counter on every re-render.
  const idFactory = createSequentialIdFactory("n");
  return renderHook(() =>
    useComposerController({
      manifest: fixtureManifest,
      sample: makeAbcDocument(),
      idFactory,
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("useComposerController — clipboard lifecycle", () => {
  it("starts with an empty clipboard", () => {
    const { result } = setup();
    expect(result.current.state.clipboard).toBeNull();
  });

  it("copy sets the clipboard without writing to storage (session state only)", () => {
    const { result } = setup();
    const before = localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY);
    act(() => result.current.copy("B"));
    expect(result.current.state.clipboard).toMatchObject({ id: "B" });
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
    // The document itself (the only thing ever written) is unchanged.
    expect(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)).toBe(before);
  });

  it("cut removes the node from the document, persists it, and fills the clipboard", () => {
    const { result } = setup();
    act(() => result.current.cut("B"));
    expect(result.current.state.document.root[0]!.slots.right.map((n: { id: string }) => n.id)).toEqual(["C"]);
    expect(result.current.state.clipboard).toMatchObject({ id: "B" });
    const persisted = JSON.parse(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)!);
    expect(persisted.root[0].slots.right.map((n: { id: string }) => n.id)).toEqual(["C"]);
    // The persisted blob is the document only — no clipboard key leaks into storage.
    expect(persisted.clipboard).toBeUndefined();
  });

  it("paste inserts a freshly-id'd clone, selects it, reveals ancestors, and persists", () => {
    const { result } = setup();
    act(() => result.current.copy("B"));
    act(() => result.current.paste({ parentId: "split", slotId: "right", index: 0 }));
    const rightIds = result.current.state.document.root[0]!.slots.right.map((n: { id: string }) => n.id);
    expect(rightIds).toHaveLength(3);
    // copy (unlike cut) leaves the source in place — B/C are untouched, and a
    // freshly-id'd clone is inserted alongside them, not replacing anything.
    expect(rightIds).toEqual([expect.stringMatching(/^(?!B$).+/), "B", "C"]);
    expect(result.current.state.selectedId).toBe(rightIds[0]);
    expect(result.current.state.expandedIds.has("split")).toBe(true);
    const persisted = JSON.parse(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)!);
    expect(persisted.root[0].slots.right).toHaveLength(3);
  });

  it("pasting the same clipboard twice yields two distinct node ids in the document", () => {
    const { result } = setup();
    act(() => result.current.copy("B"));
    act(() => result.current.paste({ parentId: null, slotId: "root", index: 0 }));
    const firstPastedId = result.current.state.document.root[0]!.id;
    act(() => result.current.paste({ parentId: null, slotId: "root", index: 0 }));
    const secondPastedId = result.current.state.document.root[0]!.id;
    expect(firstPastedId).not.toBe(secondPastedId);
  });

  it("duplicate inserts a sibling clone right after the source and persists", () => {
    const { result } = setup();
    act(() => result.current.duplicate("B"));
    const rightIds = result.current.state.document.root[0]!.slots.right.map((n: { id: string }) => n.id);
    expect(rightIds[0]).toBe("B");
    expect(rightIds[2]).toBe("C");
    expect(rightIds[1]).not.toBe("B");
    expect(result.current.state.selectedId).toBe(rightIds[1]);
    const persisted = JSON.parse(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)!);
    expect(persisted.root[0].slots.right).toHaveLength(3);
  });

  it("copy/cut/duplicate on an opaque node surface lastError and never touch the clipboard", () => {
    localStorage.setItem(
      COMPOSER_DOCUMENT_STORAGE_KEY,
      JSON.stringify({
        ...makeAbcDocument(),
        root: [
          ...makeAbcDocument().root,
          { id: "ghost", componentId: "ghost.unknown", componentVersion: 1, props: {}, slots: {} },
        ],
      }),
    );
    const { result } = setup();

    act(() => result.current.copy("ghost"));
    expect(result.current.lastError).toMatch(/unavailable/i);
    expect(result.current.state.clipboard).toBeNull();

    act(() => result.current.cut("ghost"));
    expect(result.current.lastError).toMatch(/unavailable/i);
    expect(result.current.state.document.root.map((n: { id: string }) => n.id)).toContain("ghost");

    act(() => result.current.duplicate("ghost"));
    expect(result.current.lastError).toMatch(/unavailable/i);
  });

  it("paste into an incompatible slot surfaces lastError and leaves the document unchanged", () => {
    const { result } = setup();
    act(() => result.current.copy("B"));
    const before = result.current.state.document;
    act(() => result.current.paste({ parentId: "split", slotId: "left", index: 1 })); // single-cardinality, occupied
    expect(result.current.lastError).toMatch(/single-child/i);
    expect(result.current.state.document).toBe(before);
  });

  it("the clipboard is a snapshot that survives later document edits", () => {
    const { result } = setup();
    act(() => result.current.copy("B"));
    act(() => result.current.updateProps("B", { label: "Edited later" }));
    expect(result.current.state.document.root[0]!.slots.right.find((n: { id: string }) => n.id === "B")!.props.label).toBe(
      "Edited later",
    );
    expect(result.current.state.clipboard!.props.label).not.toBe("Edited later");
  });
});
