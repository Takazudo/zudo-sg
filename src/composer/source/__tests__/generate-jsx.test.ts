import { describe, expect, it } from "vitest";
import { generateJsx } from "../generate-jsx";
import { addNode } from "../../model/commands";
import { createSequentialIdFactory } from "../../model/id-factory";
import { traversalOrder } from "../../model/index-model";
import { VIRTUAL_ROOT_SLOT_ID } from "../../model/types";
import { SAMPLE_COMPONENT_IDS as C, SAMPLE_SLOT_IDS as S } from "../../sample/sample-ids";
import {
  FIXTURE_COMPONENT_IDS as X,
  doc,
  fixtureManifest as M,
  makeAbcDocument,
  node,
} from "../../__tests__/fixtures";

describe("generateJsx — A/B/C right-slot parity", () => {
  it("emits nodes in canonical traversal order (tree order == source order)", () => {
    const document = makeAbcDocument();
    const result = generateJsx(document, M);
    expect(result.ok).toBe(true);
    expect(result.emittedNodeOrder).toEqual(traversalOrder(document, M));
    expect(result.emittedNodeOrder).toEqual(["split", "A", "B", "C"]);
    // and visually, A precedes B precedes C in the source
    const code = result.code;
    expect(code.indexOf('label="A"')).toBeLessThan(code.indexOf('label="B"'));
    expect(code.indexOf('label="B"')).toBeLessThan(code.indexOf('label="C"'));
  });

  it("keeps parity after an insert-before-first into the right slot", () => {
    const inserted = addNode(
      makeAbcDocument(),
      M,
      { parentId: "split", slotId: S.splitRight, index: 0 },
      X.box,
      createSequentialIdFactory("ins"),
    );
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    const result = generateJsx(inserted.document, M);
    expect(result.emittedNodeOrder).toEqual(traversalOrder(inserted.document, M));
    // the inserted node comes before B in the right slot
    expect(result.emittedNodeOrder.indexOf(inserted.insertedId!)).toBeLessThan(
      result.emittedNodeOrder.indexOf("B"),
    );
  });
});

describe("generateJsx — named slots", () => {
  it("Fragment-wraps multiple named-slot children and inlines a single child", () => {
    const code = generateJsx(makeAbcDocument(), M).code;
    expect(code).toContain("left={<Box label=\"A\" />}"); // single child inline
    expect(code).toContain("right={"); // multi-child expression prop
    expect(code).toContain("<>"); // Fragment for B + C
  });

  it("omits empty named slots (never emits null props)", () => {
    const split = node(C.splitLayout, { ratio: "50-50", gap: "md" }, { [S.splitLeft]: [node(X.box, { label: "A" }, {}, "a")], [S.splitRight]: [] }, "split");
    const code = generateJsx(doc([split]), M).code;
    expect(code).not.toContain("right=");
    expect(code).not.toContain("null");
  });
});

describe("generateJsx — children handling", () => {
  it("renders a scalar `children` field as a text-bound child expression", () => {
    const code = generateJsx(doc([node(C.prose, { children: "hello", size: "md" }, {}, "p")]), M).code;
    expect(code).toContain('>{"hello"}</Prose>');
    expect(code).not.toContain("children=");
  });

  it("renders a default `children` slot as structural element children", () => {
    const stack = node(C.stack, { gap: "md" }, { [S.stackChildren]: [node(X.box, { label: "x" }, {}, "b")] }, "stack");
    const code = generateJsx(doc([stack]), M).code;
    expect(code).toContain("<Stack gap=\"md\">");
    expect(code).toContain("<Box label=\"x\" />");
    expect(code).toContain("</Stack>");
    expect(code).not.toContain("children={");
  });
});

describe("generateJsx — escaping", () => {
  it("emits a newline/quote/backslash string prop as a JS-expression attribute", () => {
    const heading = node(C.sectionHeading, { heading: 'line1\nline2 "q" \\ b', as: "h2" }, {}, "h");
    const code = generateJsx(doc([heading]), M).code;
    expect(code).toContain("heading={"); // expression form
    expect(code).not.toContain('heading="line1'); // NOT a string attribute
    expect(code).toContain("\\nline2"); // escaped newline survives
    expect(code).toContain('as="h2"'); // simple string stays a string attribute
  });

  it("emits booleans, numbers, arrays, and objects as escaped expressions", () => {
    const box = node(X.box, { label: "x", size: 3, list: [1, 2], meta: { a: 1 } }, {}, "b");
    const cta = node(X.box, {}, {}, "ignore");
    void cta;
    const code = generateJsx(doc([box]), M).code;
    expect(code).toContain("size={3}");
    expect(code).toContain("list={[1,2]}");
    expect(code).toContain('meta={{"a":1}}');
  });

  it("emits boolean props from a boolean field", () => {
    const code = generateJsx(doc([node(C.ctaButton, { href: "/x", variant: "solid", arrow: true, children: "Go" }, {}, "c")]), M).code;
    expect(code).toContain("arrow={true}");
    expect(code).toContain('>{"Go"}</CtaButton>');
  });

  it("never emits undefined or NaN", () => {
    const box = node(X.box, { label: "x", gone: undefined as never, bad: NaN as never }, {}, "b");
    const code = generateJsx(doc([box]), M).code;
    expect(code).not.toContain("undefined");
    expect(code).not.toContain("NaN");
    expect(code).not.toContain("gone");
    expect(code).not.toContain("bad");
  });
});

describe("generateJsx — imports", () => {
  it("assigns collision-safe aliases for identical export names from different modules", () => {
    const document = doc([node(X.widgetA, {}, {}, "wa"), node(X.widgetB, {}, {}, "wb")]);
    const result = generateJsx(document, M);
    expect(result.code).toContain('import { Widget } from "@fixtures/widget-a";');
    expect(result.code).toContain('import { Widget as Widget_2 } from "@fixtures/widget-b";');
    expect(result.code).toContain("<Widget />");
    expect(result.code).toContain("<Widget_2 />");
    const locals = result.imports.map((i) => i.localName).sort();
    expect(locals).toEqual(["Widget", "Widget_2"]);
  });

  it("emits a default import for a default-export component", () => {
    const code = generateJsx(doc([node(X.box, { label: "A" }, {}, "b")]), M).code;
    expect(code).toContain('import Box from "@fixtures/box";');
  });

  it("emits imports in a stable, sorted order", () => {
    const code = generateJsx(makeAbcDocument(), M).code;
    expect(code.indexOf('from "@fixtures/box"')).toBeLessThan(code.indexOf('from "@fixtures/split-layout"'));
  });
});

describe("generateJsx — diagnostics gate", () => {
  it("refuses export and returns diagnostics when an opaque node remains", () => {
    const document = doc([node(C.stack, {}, { [S.stackChildren]: [node("ghost.x", {}, {}, "g")] }, "stack")]);
    const result = generateJsx(document, M);
    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.code).toBe("");
    expect(result.diagnostics.canExport).toBe(false);
    expect(result.diagnostics.opaqueIds).toContain("g");
  });
});

describe("generateJsx — adapters + determinism", () => {
  it("defers to an optional per-component source adapter", () => {
    const code = generateJsx(doc([node(X.box, { label: "A" }, {}, "b")]), M, {
      sourceAdapters: { [X.box]: (ctx) => `<CustomBox tag="${ctx.tag}" />` },
    }).code;
    expect(code).toContain('<CustomBox tag="Box" />');
  });

  it("is deterministic across repeated runs", () => {
    const a = generateJsx(makeAbcDocument(), M).code;
    const b = generateJsx(makeAbcDocument(), M).code;
    expect(a).toBe(b);
  });

  it("emits a virtual-root Fragment, not a wrapper element or import", () => {
    const code = generateJsx(makeAbcDocument(), M).code;
    expect(code).toContain("<>");
    expect(code).not.toContain(VIRTUAL_ROOT_SLOT_ID + "="); // no `root=` attr anywhere
    expect(code).not.toMatch(/import[^\n]*\broot\b/i); // root is never imported
  });
});
