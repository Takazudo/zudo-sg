import { describe, expect, it } from "vitest";
import {
  classifyNode,
  diagnoseDocument,
  isNodeOpaque,
  isStructurallyValidDocument,
  validateInsertionTarget,
} from "../validate";
import { indexDocument } from "../index-model";
import { COMPOSITION_SCHEMA_VERSION, VIRTUAL_ROOT_SLOT_ID } from "../types";
import type { CompositionDocument, CompositionNode, InsertionTarget } from "../types";
import { SAMPLE_COMPONENT_IDS as C, SAMPLE_SLOT_IDS as S } from "../../sample/sample-ids";
import { FIXTURE_COMPONENT_IDS as X, doc, fixtureManifest as M, node } from "../../__tests__/fixtures";

const locateIn =
  (d: CompositionDocument) =>
  (id: string): CompositionNode | undefined =>
    indexDocument(d, M).byId.get(id)?.node;

describe("isStructurallyValidDocument", () => {
  const good = (): CompositionDocument => doc([node(X.box, { label: "A" }, {}, "a")]);

  it("accepts a well-formed document", () => {
    expect(isStructurallyValidDocument(good())).toBe(true);
  });

  it("accepts a document that references an unknown component (still structural)", () => {
    expect(isStructurallyValidDocument(doc([node("ghost.x", {}, {}, "g")]))).toBe(true);
  });

  it("rejects a wrong schema version", () => {
    expect(isStructurallyValidDocument({ ...good(), schemaVersion: 99 })).toBe(false);
  });

  it("rejects a non-array root", () => {
    expect(isStructurallyValidDocument({ ...good(), root: {} })).toBe(false);
  });

  it("rejects duplicate node ids", () => {
    const dup = doc([node(X.box, {}, {}, "same"), node(X.box, {}, {}, "same")]);
    expect(isStructurallyValidDocument(dup)).toBe(false);
  });

  it("rejects non-JSON-safe props", () => {
    const bad = doc([node(X.box, { fn: (() => 1) as never }, {}, "a")]);
    expect(isStructurallyValidDocument(bad)).toBe(false);
  });

  it("rejects a structural cycle via a shared reference", () => {
    const child = node(X.box, {}, {}, "child");
    const parent = node(C.stack, {}, { [S.stackChildren]: [child] }, "parent");
    // Force a cycle: the child references its ancestor.
    child.slots = { [S.stackChildren]: [parent] };
    expect(isStructurallyValidDocument(doc([parent]))).toBe(false);
  });

  it("rejects a missing id/name", () => {
    const d = good() as unknown as Record<string, unknown>;
    expect(isStructurallyValidDocument({ ...d, name: 5 })).toBe(false);
  });
});

describe("classifyNode / opaque detection", () => {
  it("marks an unknown component opaque", () => {
    const diag = classifyNode(node("ghost.x", {}, {}, "g"), M);
    expect(diag.opaque).toBe(true);
    expect(diag.reasons[0].code).toBe("unknown-component");
  });

  it("marks an unsupported (future) version opaque", () => {
    const n: CompositionNode = { id: "n", componentId: C.stack, componentVersion: 2, props: {}, slots: {} };
    const diag = classifyNode(n, M);
    expect(diag.opaque).toBe(true);
    expect(diag.reasons[0].code).toBe("unsupported-version");
  });

  it("marks a removed slot opaque", () => {
    const n = node(C.stack, {}, { removed: [] }, "n");
    const diag = classifyNode(n, M);
    expect(diag.reasons.some((r) => r.code === "removed-slot")).toBe(true);
  });

  it("marks a single-cardinality overflow opaque", () => {
    const n = node(
      C.splitLayout,
      {},
      { [S.splitLeft]: [node(X.box, {}, {}, "x"), node(X.box, {}, {}, "y")], [S.splitRight]: [] },
      "n",
    );
    const diag = classifyNode(n, M);
    expect(diag.reasons.some((r) => r.code === "cardinality-violation")).toBe(true);
  });

  it("marks an unaccepted child opaque", () => {
    const n = node(X.gallery, {}, { items: [node(C.stack, {}, { [S.stackChildren]: [] }, "s")] }, "n");
    const diag = classifyNode(n, M);
    expect(diag.reasons.some((r) => r.code === "unaccepted-child")).toBe(true);
  });

  it("treats a valid node as available", () => {
    expect(isNodeOpaque(node(C.stack, { gap: "md" }, { [S.stackChildren]: [] }, "n"), M)).toBe(false);
  });
});

describe("diagnoseDocument", () => {
  it("blocks export when any node is opaque and lists opaque ids", () => {
    const d = doc([
      node(C.stack, {}, { [S.stackChildren]: [node("ghost.x", {}, {}, "g")] }, "stack"),
    ]);
    const diag = diagnoseDocument(d, M);
    expect(diag.hasOpaque).toBe(true);
    expect(diag.canExport).toBe(false);
    expect(diag.opaqueIds).toContain("g");
  });

  it("permits export for a fully-available document", () => {
    const d = doc([node(X.box, { label: "A" }, {}, "a")]);
    expect(diagnoseDocument(d, M).canExport).toBe(true);
  });
});

describe("validateInsertionTarget", () => {
  const d = doc([node(C.stack, {}, { [S.stackChildren]: [node(X.box, {}, {}, "x")] }, "stack")]);

  it("accepts a valid virtual-root target", () => {
    const target: InsertionTarget = { parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 1 };
    expect(validateInsertionTarget(d, M, target, locateIn(d)).ok).toBe(true);
  });

  it("rejects a virtual-root target with the wrong slot id", () => {
    const target: InsertionTarget = { parentId: null, slotId: "left", index: 0 };
    expect(validateInsertionTarget(d, M, target, locateIn(d)).ok).toBe(false);
  });

  it("accepts a valid slot target and append index", () => {
    const target: InsertionTarget = { parentId: "stack", slotId: S.stackChildren, index: 1 };
    expect(validateInsertionTarget(d, M, target, locateIn(d)).ok).toBe(true);
  });

  it("rejects an index beyond the slot length", () => {
    const target: InsertionTarget = { parentId: "stack", slotId: S.stackChildren, index: 2 };
    expect(validateInsertionTarget(d, M, target, locateIn(d)).ok).toBe(false);
  });

  it("rejects a missing parent", () => {
    const target: InsertionTarget = { parentId: "nope", slotId: S.stackChildren, index: 0 };
    expect(validateInsertionTarget(d, M, target, locateIn(d)).ok).toBe(false);
  });
});

describe("schema version constant", () => {
  it("is 1", () => {
    expect(COMPOSITION_SCHEMA_VERSION).toBe(1);
  });
});
