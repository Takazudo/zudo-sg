// Tests for the clipboard/duplicate foundation (wave 6, issue #255):
// `cloneSubtreeWithNewIds` + `insertSubtree`. These are pure model primitives
// the #247 controller composes into copy/cut/paste/duplicate — see that
// module's own tests for the controller-level lifecycle.

import { describe, expect, it } from "vitest";
import { cloneSubtreeWithNewIds, insertSubtree } from "../commands";
import { createSequentialIdFactory } from "../id-factory";
import { indexDocument } from "../index-model";
import { VIRTUAL_ROOT_SLOT_ID } from "../types";
import type { InsertionTarget } from "../types";
import { SAMPLE_COMPONENT_IDS as C, SAMPLE_SLOT_IDS as S } from "../../sample/sample-ids";
import {
  FIXTURE_COMPONENT_IDS as X,
  doc,
  fixtureManifest as M,
  makeAbcDocument,
  node,
} from "../../__tests__/fixtures";

const ids = () => createSequentialIdFactory("clone");

describe("cloneSubtreeWithNewIds", () => {
  it("re-issues the root id and every descendant id, preserving componentId/version/props/slot shape", () => {
    const stack = node(
      C.stack,
      { gap: "md" },
      {
        [S.stackChildren]: [
          node(X.box, { label: "A" }, {}, "a"),
          node(X.box, { label: "B" }, {}, "b"),
        ],
      },
      "stack",
    );
    const clone = cloneSubtreeWithNewIds(stack, ids());

    expect(clone.id).not.toBe("stack");
    expect(clone.componentId).toBe(stack.componentId);
    expect(clone.componentVersion).toBe(stack.componentVersion);
    expect(clone.props).toEqual(stack.props);

    const clonedChildren = clone.slots[S.stackChildren];
    expect(clonedChildren).toHaveLength(2);
    expect(clonedChildren.map((c) => c.componentId)).toEqual(["x.box", "x.box"]);
    expect(clonedChildren.map((c) => c.props.label)).toEqual(["A", "B"]);
    // Every id in the clone — root and descendants — is fresh.
    const originalIds = new Set(["stack", "a", "b"]);
    const cloneIds = [clone.id, ...clonedChildren.map((c) => c.id)];
    for (const id of cloneIds) expect(originalIds.has(id)).toBe(false);
    expect(new Set(cloneIds).size).toBe(cloneIds.length); // internally unique too
  });

  it("does not mutate the source subtree", () => {
    const box = node(X.box, { label: "A" }, {}, "a");
    const before = JSON.parse(JSON.stringify(box));
    cloneSubtreeWithNewIds(box, ids());
    expect(box).toEqual(before);
  });

  it("produces fully distinct id sets across two separate clones of the same source", () => {
    const stack = node(
      C.stack,
      {},
      { [S.stackChildren]: [node(X.box, {}, {}, "a"), node(X.box, {}, {}, "b")] },
      "stack",
    );
    const factory = ids();
    const first = cloneSubtreeWithNewIds(stack, factory);
    const second = cloneSubtreeWithNewIds(stack, factory);

    const idsOf = (n: typeof first): string[] => [n.id, ...Object.values(n.slots).flat().map((c) => c.id)];
    const firstIds = idsOf(first);
    const secondIds = idsOf(second);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(firstIds.length + secondIds.length);
  });
});

describe("insertSubtree", () => {
  const rootTarget = (index: number): InsertionTarget => ({
    parentId: null,
    slotId: VIRTUAL_ROOT_SLOT_ID,
    index,
  });

  it("inserts a cloned subtree into the virtual root and selects it", () => {
    const clone = cloneSubtreeWithNewIds(node(X.box, { label: "A" }, {}, "a"), ids());
    const result = insertSubtree(doc([]), M, rootTarget(0), clone);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.root).toHaveLength(1);
    expect(result.document.root[0].id).toBe(clone.id);
    expect(result.selectedId).toBe(clone.id);
    expect(result.insertedId).toBe(clone.id);
  });

  it("inserts a whole subtree (with descendants) into a named slot at an explicit index", () => {
    const before = makeAbcDocument();
    const boxClone = cloneSubtreeWithNewIds(node(X.box, { label: "D" }, {}, "d"), ids());
    const target: InsertionTarget = { parentId: "split", slotId: S.splitRight, index: 1 };
    const result = insertSubtree(before, M, target, boxClone);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.root[0].slots[S.splitRight].map((c) => c.id)).toEqual(["B", boxClone.id, "C"]);
    // input untouched
    expect(before.root[0].slots[S.splitRight]).toHaveLength(2);
  });

  it("preserves descendant structure of a multi-level subtree on insert", () => {
    const split = node(
      C.splitLayout,
      { ratio: "50-50", gap: "md" },
      {
        [S.splitLeft]: [node(X.box, { label: "L" }, {}, "l")],
        [S.splitRight]: [],
      },
      "split-src",
    );
    const clone = cloneSubtreeWithNewIds(split, ids());
    const result = insertSubtree(doc([]), M, rootTarget(0), clone);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inserted = result.document.root[0];
    expect(inserted.slots[S.splitLeft]).toHaveLength(1);
    expect(inserted.slots[S.splitLeft][0].props.label).toBe("L");
    expect(inserted.slots[S.splitLeft][0].id).not.toBe("l");
  });

  it("rejects a virtual-root target with the wrong slot id", () => {
    const clone = cloneSubtreeWithNewIds(node(X.box, {}, {}, "a"), ids());
    const target: InsertionTarget = { parentId: null, slotId: "left", index: 0 };
    const result = insertSubtree(doc([]), M, target, clone);
    expect(result.ok).toBe(false);
  });

  it("rejects an undeclared slot", () => {
    const stack = node(C.stack, {}, { [S.stackChildren]: [] }, "stack");
    const clone = cloneSubtreeWithNewIds(node(X.box, {}, {}, "a"), ids());
    const target: InsertionTarget = { parentId: "stack", slotId: "nope", index: 0 };
    const result = insertSubtree(doc([stack]), M, target, clone);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not declared/i);
  });

  it("rejects a second child in a single-cardinality slot", () => {
    const before = makeAbcDocument(); // split.left is single-cardinality, already occupied by A
    const clone = cloneSubtreeWithNewIds(node(X.box, {}, {}, "extra"), ids());
    const target: InsertionTarget = { parentId: "split", slotId: S.splitLeft, index: 1 };
    const result = insertSubtree(before, M, target, clone);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/single-child/i);
  });

  it("rejects a subtree whose component the target slot does not accept", () => {
    const gallery = node(X.gallery, {}, { items: [] }, "g");
    const stackClone = cloneSubtreeWithNewIds(node(C.stack, {}, { [S.stackChildren]: [] }, "s"), ids());
    const target: InsertionTarget = { parentId: "g", slotId: "items", index: 0 };
    const result = insertSubtree(doc([gallery]), M, target, stackClone);
    expect(result.ok).toBe(false);
  });

  it("rejects an out-of-range insertion index", () => {
    const clone = cloneSubtreeWithNewIds(node(X.box, {}, {}, "a"), ids());
    const result = insertSubtree(doc([]), M, rootTarget(3), clone);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/out of range/i);
  });

  it("rejects a non-integer insertion index", () => {
    const clone = cloneSubtreeWithNewIds(node(X.box, {}, {}, "a"), ids());
    const result = insertSubtree(doc([]), M, rootTarget(0.5), clone);
    expect(result.ok).toBe(false);
  });

  it("rejects inserting into an opaque (unknown-component) parent", () => {
    const opaque = node("ghost.component", {}, { slot: [] }, "ghost");
    const clone = cloneSubtreeWithNewIds(node(X.box, {}, {}, "a"), ids());
    const target: InsertionTarget = { parentId: "ghost", slotId: "slot", index: 0 };
    const result = insertSubtree(doc([opaque]), M, target, clone);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/opaque/i);
  });

  it("rejects a subtree whose id collides with an existing document node (ids must already be re-issued)", () => {
    const before = doc([node(X.box, {}, {}, "dup")]);
    const collidingClone: ReturnType<typeof cloneSubtreeWithNewIds> = {
      ...node(X.box, { label: "new" }, {}, "dup"),
    };
    const result = insertSubtree(before, M, rootTarget(1), collidingClone);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already exists/i);
  });

  it("does not mutate the input document or the inserted subtree", () => {
    const before = makeAbcDocument();
    const beforeSnapshot = JSON.parse(JSON.stringify(before));
    const clone = cloneSubtreeWithNewIds(node(X.box, {}, {}, "d"), ids());
    const cloneSnapshot = JSON.parse(JSON.stringify(clone));
    insertSubtree(before, M, { parentId: "split", slotId: S.splitRight, index: 0 }, clone);
    expect(before).toEqual(beforeSnapshot);
    expect(clone).toEqual(cloneSnapshot);
  });

  it("supports pasting the same clipboard twice yielding two document-distinct inserted nodes", () => {
    const source = node(X.box, { label: "X" }, {}, "src");
    const factory = ids();
    let d = doc([]);
    const first = insertSubtree(d, M, rootTarget(0), cloneSubtreeWithNewIds(source, factory));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    d = first.document;
    const second = insertSubtree(d, M, rootTarget(1), cloneSubtreeWithNewIds(source, factory));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.document.root.map((n) => n.id)).toHaveLength(2);
    expect(new Set(second.document.root.map((n) => n.id)).size).toBe(2);
    expect(indexDocument(second.document, M).byId.size).toBe(2);
  });
});
