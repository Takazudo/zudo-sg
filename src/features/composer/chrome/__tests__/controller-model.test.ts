import { describe, expect, it } from "vitest";
import { createSequentialIdFactory } from "@/composer";
import {
  FIXTURE_COMPONENT_IDS as F,
  fixtureManifest,
  makeAbcDocument,
  resetFixtureIds,
} from "@/composer/__tests__/fixtures";
import {
  applyComposerAction,
  createInitialControllerState,
  describeSaveStatus,
  hasUnsavedChanges,
  isDocumentMutation,
  type ComposerAction,
  type ComposerReducerContext,
} from "../controller-model";

// Shared fixture manifest/document reused verbatim from #245 — its header
// comment names #247 as an intended downstream consumer.

function ctx(): ComposerReducerContext {
  return { manifest: fixtureManifest, idFactory: createSequentialIdFactory("n") };
}

function initial() {
  resetFixtureIds();
  return createInitialControllerState({
    document: makeAbcDocument(),
    manifest: fixtureManifest,
    loadNotice: null,
    saveStatus: { kind: "saved" },
    leftWidth: 260,
    rightWidth: 320,
  });
}

describe("createInitialControllerState", () => {
  it("selects the first root node and starts with no expansion", () => {
    const state = initial();
    expect(state.selectedId).toBe("split");
    expect(state.expandedIds.size).toBe(0);
    expect(state.mode).toBe("edit");
    expect(state.viewport).toBe("fluid");
    expect(state.leftWidth).toBe(260);
    expect(state.rightWidth).toBe(320);
  });
});

describe("applyComposerAction — document commands", () => {
  it("add uses the shared InsertionTarget shape and selects the inserted node", () => {
    const state = initial();
    const { state: next, error, documentChanged } = applyComposerAction(
      state,
      { type: "add", target: { parentId: "split", slotId: "right", index: 2 }, componentId: F.box },
      ctx(),
    );
    expect(error).toBeNull();
    expect(documentChanged).toBe(true);
    expect(next.selectedId).not.toBe(state.selectedId);
    expect(next.document.root[0]!.slots.right).toHaveLength(3);
  });

  it("add surfaces a command error and leaves state untouched (unknown component)", () => {
    const state = initial();
    const { state: next, error, documentChanged } = applyComposerAction(
      state,
      { type: "add", target: { parentId: "split", slotId: "right", index: 0 }, componentId: "nope" },
      ctx(),
    );
    expect(error).toMatch(/unknown component/i);
    expect(documentChanged).toBe(false);
    expect(next).toBe(state);
  });

  it("add into a single-cardinality occupied slot is rejected", () => {
    const state = initial();
    const { error, documentChanged } = applyComposerAction(
      state,
      { type: "add", target: { parentId: "split", slotId: "left", index: 1 }, componentId: F.box },
      ctx(),
    );
    expect(error).toMatch(/single-child/i);
    expect(documentChanged).toBe(false);
  });

  it("updateProps merges a JSON-safe patch and rejects a bad field value", () => {
    const state = initial();
    const ok = applyComposerAction(state, { type: "updateProps", nodeId: "A", patch: { label: "AA" } }, ctx());
    expect(ok.error).toBeNull();
    expect(ok.documentChanged).toBe(true);
    expect(ok.state.document.root[0]!.slots.left[0]!.props.label).toBe("AA");

    const bad = applyComposerAction(
      state,
      { type: "updateProps", nodeId: "A", patch: { size: 999 } },
      ctx(),
    );
    expect(bad.error).toMatch(/above max/i);
    expect(bad.documentChanged).toBe(false);
  });

  it("reorder swaps siblings and is a no-op (not an error) at a boundary", () => {
    const state = initial();
    const moved = applyComposerAction(state, { type: "reorder", nodeId: "B", direction: "down" }, ctx());
    expect(moved.error).toBeNull();
    expect(moved.documentChanged).toBe(true);
    expect(moved.state.document.root[0]!.slots.right.map((n) => n.id)).toEqual(["C", "B"]);

    const boundary = applyComposerAction(moved.state, { type: "reorder", nodeId: "B", direction: "down" }, ctx());
    expect(boundary.error).toBeNull();
    expect(boundary.documentChanged).toBe(false);
  });

  it("remove repairs selection to a sibling and clears the removed subtree", () => {
    const state = { ...initial(), selectedId: "B" };
    const { state: next, error, documentChanged } = applyComposerAction(
      state,
      { type: "remove", nodeId: "B" },
      ctx(),
    );
    expect(error).toBeNull();
    expect(documentChanged).toBe(true);
    expect(next.selectedId).toBe("C");
    expect(next.document.root[0]!.slots.right.map((n) => n.id)).toEqual(["C"]);
  });
});

describe("applyComposerAction — reset / load", () => {
  it("resetToSample replaces the document, clears selection/expansion/notice, and reports a change", () => {
    const state = { ...initial(), expandedIds: new Set(["split"]), loadNotice: { kind: "recovered" as const, reason: "x" } };
    const sample = makeAbcDocument();
    const { state: next, documentChanged } = applyComposerAction(
      state,
      { type: "resetToSample", document: sample },
      ctx(),
    );
    expect(documentChanged).toBe(true);
    expect(next.document).toBe(sample);
    expect(next.expandedIds.size).toBe(0);
    expect(next.loadNotice).toBeNull();
    expect(next.selectedId).toBe("split");
  });

  it("loadDocument swaps the document without marking it as a change (it already matches storage)", () => {
    const state = initial();
    const sample = makeAbcDocument();
    const notice = { kind: "quarantined" as const, foundSchemaVersion: 99 };
    const { state: next, documentChanged } = applyComposerAction(
      state,
      { type: "loadDocument", document: sample, notice },
      ctx(),
    );
    expect(documentChanged).toBe(false);
    expect(next.document).toBe(sample);
    expect(next.loadNotice).toEqual(notice);
  });

  it("loadDocument keeps the current selection when it still resolves in the new document", () => {
    const state = { ...initial(), selectedId: "B" };
    const sameShapeDoc = makeAbcDocument();
    const { state: next } = applyComposerAction(
      state,
      { type: "loadDocument", document: sameShapeDoc, notice: null },
      ctx(),
    );
    expect(next.selectedId).toBe("B");
  });
});

describe("applyComposerAction — selection, reveal, expansion", () => {
  it("select sets selectedId verbatim, including null", () => {
    const state = initial();
    expect(applyComposerAction(state, { type: "select", nodeId: "B" }, ctx()).state.selectedId).toBe("B");
    expect(applyComposerAction(state, { type: "select", nodeId: null }, ctx()).state.selectedId).toBeNull();
  });

  it("reveal selects the node and expands every ancestor", () => {
    const state = initial();
    const { state: next } = applyComposerAction(state, { type: "reveal", nodeId: "B" }, ctx());
    expect(next.selectedId).toBe("B");
    expect(next.expandedIds.has("split")).toBe(true);
  });

  it("toggleExpanded flips membership; setExpanded is absolute", () => {
    const state = initial();
    const opened = applyComposerAction(state, { type: "toggleExpanded", nodeId: "split" }, ctx()).state;
    expect(opened.expandedIds.has("split")).toBe(true);
    const closed = applyComposerAction(opened, { type: "toggleExpanded", nodeId: "split" }, ctx()).state;
    expect(closed.expandedIds.has("split")).toBe(false);

    const forced = applyComposerAction(state, { type: "setExpanded", nodeId: "split", expanded: true }, ctx()).state;
    expect(forced.expandedIds.has("split")).toBe(true);
  });
});

describe("applyComposerAction — mode, viewport, widths, save status", () => {
  it("setMode / setViewport / setLeftWidth / setRightWidth update verbatim and never touch the document", () => {
    const state = initial();
    expect(applyComposerAction(state, { type: "setMode", mode: "preview" }, ctx()).state.mode).toBe("preview");
    expect(applyComposerAction(state, { type: "setViewport", viewport: "mobile" }, ctx()).state.viewport).toBe(
      "mobile",
    );
    const widthResult = applyComposerAction(state, { type: "setLeftWidth", width: 300 }, ctx());
    expect(widthResult.state.leftWidth).toBe(300);
    expect(widthResult.documentChanged).toBe(false);
    expect(widthResult.state.document).toBe(state.document);
  });

  it("dismissLoadNotice clears the notice without touching anything else", () => {
    const state = { ...initial(), loadNotice: { kind: "recovered" as const, reason: "x" } };
    const next = applyComposerAction(state, { type: "dismissLoadNotice" }, ctx()).state;
    expect(next.loadNotice).toBeNull();
    expect(next.document).toBe(state.document);
  });

  it("setSaveStatus updates verbatim", () => {
    const state = initial();
    const next = applyComposerAction(
      state,
      { type: "setSaveStatus", status: { kind: "error", reason: "quota" } },
      ctx(),
    ).state;
    expect(next.saveStatus).toEqual({ kind: "error", reason: "quota" });
  });
});

describe("isDocumentMutation / hasUnsavedChanges", () => {
  it("flags exactly the document-mutating action types", () => {
    expect(isDocumentMutation({ type: "add", target: { parentId: null, slotId: "root", index: 0 }, componentId: "x" })).toBe(
      true,
    );
    expect(isDocumentMutation({ type: "updateProps", nodeId: "x", patch: {} })).toBe(true);
    expect(isDocumentMutation({ type: "reorder", nodeId: "x", direction: "up" })).toBe(true);
    expect(isDocumentMutation({ type: "remove", nodeId: "x" })).toBe(true);
    expect(isDocumentMutation({ type: "resetToSample", document: makeAbcDocument() })).toBe(true);
    expect(isDocumentMutation({ type: "select", nodeId: null })).toBe(false);
    expect(isDocumentMutation({ type: "setMode", mode: "edit" })).toBe(false);
    expect(isDocumentMutation({ type: "loadDocument", document: makeAbcDocument(), notice: null })).toBe(false);
  });

  it("hasUnsavedChanges is false only when saveStatus is saved", () => {
    const state = initial();
    expect(hasUnsavedChanges(state)).toBe(false);
    expect(hasUnsavedChanges({ ...state, saveStatus: { kind: "unsaved" } })).toBe(true);
    expect(hasUnsavedChanges({ ...state, saveStatus: { kind: "error", reason: "x" } })).toBe(true);
    expect(hasUnsavedChanges({ ...state, saveStatus: { kind: "quarantined", foundSchemaVersion: 2 } })).toBe(true);
  });
});

describe("describeSaveStatus", () => {
  it("has one honest, distinct wording per status kind, and every non-saved wording says 'Not saved'", () => {
    expect(describeSaveStatus({ kind: "saved" })).toBe("Saved locally");
    for (const status of [
      { kind: "unsaved" as const },
      { kind: "error" as const, reason: "quota" },
      { kind: "quarantined" as const, foundSchemaVersion: 2 },
    ]) {
      expect(describeSaveStatus(status)).toMatch(/not saved/i);
    }
  });
});
