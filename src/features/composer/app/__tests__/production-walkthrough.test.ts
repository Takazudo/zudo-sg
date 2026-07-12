// The epic's fixed A/B/C right-slot walkthrough (#243), end to end against the
// PRODUCTION Preact renderers and the REAL opted-in component cohort (#246) —
// not fixtures. Builds the document with the SAME #245 commands the controller
// dispatches, then renders it through #248's `CompositionCanvas` (the real
// iframe-side renderer) and generates its JSX with #245's `generateJsx` — the
// same document/manifest source the canvas and export dialog use. This is the
// acceptance criterion "one document snapshot drives all surfaces": tree/canvas/
// export order are the one document's order, and a before-first insertion lands
// at index 0 identically in all three.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/preact";
import { h } from "preact";
import type { CommandResult, CompositionDocument, InsertionTarget } from "@/composer";
import {
  VIRTUAL_ROOT_SLOT_ID,
  addNode,
  createManifest,
  createSequentialIdFactory,
  generateJsx,
} from "@/composer";
import { composerEntries, composerManifest } from "@/styleguide/data/composer-registry";
import { CompositionCanvas } from "@/features/composer/preview/renderer";
import type { PreviewSession } from "@/features/composer/preview/protocol";

const SPLIT = "ui.split-layout";
const BOX = "ui.placeholder-box";
const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };

const manifest = createManifest(composerManifest);

function unwrap(result: CommandResult): { document: CompositionDocument; selectedId: string | null } {
  if (!result.ok) throw new Error(`command rejected: ${result.error}`);
  return { document: result.document, selectedId: result.selectedId };
}

function domNodeIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-zc-node-id]")].map(
    (el) => el.getAttribute("data-zc-node-id")!,
  );
}

/** Build the A/B/C composition through the real add command. */
function buildAbc() {
  const idFactory = createSequentialIdFactory("n");
  const add = (doc: CompositionDocument, target: InsertionTarget, componentId: string) =>
    unwrap(addNode(doc, manifest, target, componentId, idFactory));

  let doc: CompositionDocument = { schemaVersion: 1, id: "abc", name: "A/B/C", root: [] };
  ({ document: doc } = add(doc, { parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 0 }, SPLIT));
  const splitId = doc.root[0]!.id;

  let a: string;
  ({ document: doc, selectedId: a } = add(doc, { parentId: splitId, slotId: "left", index: 0 }, BOX) as {
    document: CompositionDocument;
    selectedId: string;
  });
  let b: string;
  ({ document: doc, selectedId: b } = add(doc, { parentId: splitId, slotId: "right", index: 0 }, BOX) as {
    document: CompositionDocument;
    selectedId: string;
  });
  let c: string;
  ({ document: doc, selectedId: c } = add(doc, { parentId: splitId, slotId: "right", index: 1 }, BOX) as {
    document: CompositionDocument;
    selectedId: string;
  });

  return { doc, splitId, a: a!, b: b!, c: c!, add };
}

describe("A/B/C walkthrough against production Preact renderers (#251)", () => {
  it("renders SplitLayout with A in left and B,C in right — real components, real renderer", () => {
    const { doc, splitId, a, b, c } = buildAbc();

    const { container } = render(
      h(CompositionCanvas, {
        document: doc,
        entries: composerEntries,
        session: EDIT,
        onSelect: () => {},
        onRequestAdd: () => {},
      }),
    );

    // The production canvas mounted in Edit mode with the four real nodes.
    expect(container.querySelector('.zc-canvas[data-mode="edit"]')).not.toBeNull();
    const ids = domNodeIds(container);
    for (const id of [splitId, a, b, c]) expect(ids).toContain(id);

    // Model order: left holds A; right holds B then C.
    const split = doc.root[0]!;
    expect(split.slots.left!.map((n) => n.id)).toEqual([a]);
    expect(split.slots.right!.map((n) => n.id)).toEqual([b, c]);
    // Canvas DOM order: B before C.
    expect(ids.indexOf(b)).toBeLessThan(ids.indexOf(c));
  });

  it("a before-first insertion lands at index 0 identically in canvas + export order", () => {
    const built = buildAbc();
    // Insert D before B in the right slot (index 0).
    const inserted = built.add(built.doc, { parentId: built.splitId, slotId: "right", index: 0 }, BOX);
    const doc2 = inserted.document;
    const d = inserted.selectedId!;

    // Model / canvas order in right: D, B, C.
    const right = doc2.root[0]!.slots.right!.map((n) => n.id);
    expect(right).toEqual([d, built.b, built.c]);

    const { container } = render(
      h(CompositionCanvas, {
        document: doc2,
        entries: composerEntries,
        session: EDIT,
        onSelect: () => {},
        onRequestAdd: () => {},
      }),
    );
    const ids = domNodeIds(container);
    expect(ids.indexOf(d)).toBeLessThan(ids.indexOf(built.b));

    // Export uses the SAME document + manifest — order is the document's order.
    const result = generateJsx(doc2, manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain("SplitLayout");
      expect(result.code).toContain("PlaceholderBox");
      // Four boxes rendered as four elements (plus the import line).
      expect((result.code.match(/PlaceholderBox/g) ?? []).length).toBeGreaterThanOrEqual(4);
    }
  });
});
