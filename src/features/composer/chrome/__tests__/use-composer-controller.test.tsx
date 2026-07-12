import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/preact";
import { createSequentialIdFactory } from "@/composer";
import { fixtureManifest, makeAbcDocument, resetFixtureIds } from "@/composer/__tests__/fixtures";
import { useComposerController, type ComposerController } from "../use-composer-controller";
import { COMPOSER_DOCUMENT_STORAGE_KEY } from "../storage";
import { LS_INSPECTOR_WIDTH, LS_TREE_WIDTH } from "../resizer-contract";
import { BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

function setup() {
  resetFixtureIds();
  return renderHook(() =>
    useComposerController({
      manifest: fixtureManifest,
      sample: makeAbcDocument(),
      idFactory: createSequentialIdFactory("n"),
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("useComposerController — save / reload / reset", () => {
  it("starts saved after writing a fresh sample to storage", () => {
    const { result } = setup();
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
    expect(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)).not.toBeNull();
  });

  it("add/updateProps/reorder/remove mutate the document and stay saved", () => {
    const { result } = setup();
    act(() => result.current.add({ parentId: "split", slotId: "right", index: 2 }, "x.box"));
    expect(result.current.state.document.root[0]!.slots.right).toHaveLength(3);
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
    const persisted = JSON.parse(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)!);
    expect(persisted.root[0].slots.right).toHaveLength(3);

    act(() => result.current.updateProps("A", { label: "AA" }));
    expect(result.current.state.document.root[0]!.slots.left[0]!.props.label).toBe("AA");

    act(() => result.current.remove("B"));
    expect(result.current.state.document.root[0]!.slots.right.map((n: { id: string }) => n.id)).not.toContain("B");
  });

  it("surfaces a rejected command via lastError without changing the document or save status", () => {
    const { result } = setup();
    act(() => result.current.add({ parentId: "split", slotId: "right", index: 0 }, "does-not-exist"));
    expect(result.current.lastError).toMatch(/unknown component/i);
    expect(result.current.state.document.root[0]!.slots.right).toHaveLength(2);
  });

  it("reload picks up a change written by another tab", () => {
    const { result } = setup();
    const other = { ...result.current.state.document, name: "Edited elsewhere" };
    localStorage.setItem(COMPOSER_DOCUMENT_STORAGE_KEY, JSON.stringify(other));

    act(() => result.current.reload());
    expect(result.current.state.document.name).toBe("Edited elsewhere");
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
  });

  it("reset overwrites storage with a fresh sample and clears selection/expansion", () => {
    const { result } = setup();
    act(() => result.current.toggleExpanded("split"));
    act(() => result.current.reset());
    expect(result.current.state.expandedIds.size).toBe(0);
    expect(result.current.state.selectedId).toBe("split");
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
  });
});

describe("useComposerController — malformed / future-schema quarantine", () => {
  it("recovers a malformed document to the sample and writes the recovery back", () => {
    localStorage.setItem(COMPOSER_DOCUMENT_STORAGE_KEY, "{not json");
    const { result } = setup();
    expect(result.current.state.loadNotice?.kind).toBe("recovered");
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
    expect(() => JSON.parse(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)!)).not.toThrow();
  });

  it("quarantines a future schema, works against the sample, and never autosaves until reset", () => {
    const rawFuture = JSON.stringify({ schemaVersion: 999, id: "future", name: "Future", root: [] });
    localStorage.setItem(COMPOSER_DOCUMENT_STORAGE_KEY, rawFuture);
    const { result } = setup();

    expect(result.current.state.loadNotice).toEqual({ kind: "quarantined", foundSchemaVersion: 999 });
    expect(result.current.state.saveStatus).toEqual({ kind: "quarantined", foundSchemaVersion: 999 });
    expect(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)).toBe(rawFuture);

    // Editing works in-memory but must NOT touch the quarantined raw storage.
    act(() => result.current.add({ parentId: "split", slotId: "right", index: 2 }, "x.box"));
    expect(result.current.state.document.root[0]!.slots.right).toHaveLength(3);
    expect(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)).toBe(rawFuture);
    expect(result.current.state.saveStatus).toEqual({ kind: "quarantined", foundSchemaVersion: 999 });

    // Only an explicit reset is allowed to overwrite it.
    act(() => result.current.reset());
    expect(result.current.state.loadNotice).toBeNull();
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
    expect(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)).not.toBe(rawFuture);
  });

  it("dismissLoadNotice clears the banner without touching storage or the quarantine gate", () => {
    const rawFuture = JSON.stringify({ schemaVersion: 999, id: "future", name: "Future", root: [] });
    localStorage.setItem(COMPOSER_DOCUMENT_STORAGE_KEY, rawFuture);
    const { result } = setup();
    act(() => result.current.dismissLoadNotice());
    expect(result.current.state.loadNotice).toBeNull();
    expect(result.current.state.saveStatus).toEqual({ kind: "quarantined", foundSchemaVersion: 999 });
  });
});

describe("useComposerController — typed callback seams", () => {
  it("exposes exactly the documented controller methods", () => {
    const { result } = setup();
    const expected: Array<keyof ComposerController> = [
      "state",
      "manifest",
      "lastError",
      "add",
      "updateProps",
      "reorder",
      "remove",
      "select",
      "reveal",
      "toggleExpanded",
      "setExpanded",
      "setMode",
      "setViewport",
      "setLeftWidth",
      "setRightWidth",
      "reload",
      "reset",
      "dismissLoadNotice",
    ];
    for (const key of expected) expect(result.current).toHaveProperty(key);
  });

  it("select / reveal / toggleExpanded / setMode / setViewport update session state without touching the document", () => {
    const { result } = setup();
    const before = result.current.state.document;
    act(() => result.current.select("B"));
    expect(result.current.state.selectedId).toBe("B");
    act(() => result.current.reveal("B"));
    expect(result.current.state.expandedIds.has("split")).toBe(true);
    act(() => result.current.setMode("preview"));
    expect(result.current.state.mode).toBe("preview");
    act(() => result.current.setViewport("mobile"));
    expect(result.current.state.viewport).toBe("mobile");
    expect(result.current.state.document).toBe(before);
  });

  it("setLeftWidth / setRightWidth update state and persist to the resizer's own storage keys", () => {
    const { result } = setup();
    act(() => result.current.setLeftWidth(300));
    act(() => result.current.setRightWidth(340));
    expect(result.current.state.leftWidth).toBe(300);
    expect(result.current.state.rightWidth).toBe(340);
    expect(localStorage.getItem(LS_TREE_WIDTH)).toBe("300");
    expect(localStorage.getItem(LS_INSPECTOR_WIDTH)).toBe("340");
  });
});

describe("useComposerController — navigation guard wiring", () => {
  it("blocks the SPA transition event while there are unsaved (quarantined) edits, and releases it after reset", () => {
    const rawFuture = JSON.stringify({ schemaVersion: 999, id: "future", name: "Future", root: [] });
    localStorage.setItem(COMPOSER_DOCUMENT_STORAGE_KEY, rawFuture);
    const { result } = setup();

    const blocked = !document.dispatchEvent(new Event(BEFORE_NAVIGATE_EVENT, { cancelable: true }));
    expect(blocked).toBe(true);

    act(() => result.current.reset());
    const allowed = !document.dispatchEvent(new Event(BEFORE_NAVIGATE_EVENT, { cancelable: true }));
    expect(allowed).toBe(false);
  });
});
