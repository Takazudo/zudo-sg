/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Central integration tests (issue #251): every surface driven by ONE
// controller, one document snapshot. The canvas iframe is stood in for by the
// REAL #248 bridge over a recording frame (makeTestBridge), so canvas-originated
// events (select / request-add) and outbound snapshots are exercised for real.
// The tree/chooser/inspector/toolbar are the genuine components.

import { beforeEach, describe, expect, it } from "vitest";
import { act } from "preact/test-utils";
import { fireEvent, render, screen, within } from "@testing-library/preact";
import type { CompositionDocument, InsertionTarget } from "@/composer";
import { VIRTUAL_ROOT_SLOT_ID, createSequentialIdFactory } from "@/composer";
import { readyMessage, requestAddMessage, selectMessage } from "@/features/composer/preview/protocol";
import { ComposerIntegration } from "../composer-integration";
import { makeTestBridge } from "../test-support/preview-harness";
import { LS_COMPOSER_VIEWPORT } from "../viewport";
import { fixtureCatalog, FIXTURE_IDS } from "../../ui/tree/__tests__/fixtures";

function emptyDoc(): CompositionDocument {
  return { schemaVersion: 1, id: "it-doc", name: "Integration Doc", root: [] };
}

const ROOT: InsertionTarget = { parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (v: unknown) => v as any;

let rev = 1000;

function setup(seedViewport?: string) {
  if (seedViewport) localStorage.setItem(LS_COMPOSER_VIEWPORT, seedViewport);
  const bridge = makeTestBridge();
  const utils = render(
    <ComposerIntegration
      manifestEntries={fixtureCatalog}
      controllerOptions={{ sample: emptyDoc(), idFactory: createSequentialIdFactory("n") }}
      createBridge={bridge.createBridge}
      previewLocation={bridge.location}
    />,
  );
  act(() => bridge.deliver(readyMessage()));

  const region = (selector: string) => utils.container.querySelector(selector) as HTMLElement;
  const tree = () => region("#sg-composer-tree");
  const inspector = () => region("#sg-composer-inspector");
  const chooser = () => utils.container.querySelector("dialog.sg-composer-chooser") as HTMLElement;
  const toolbar = () => screen.getByRole("toolbar", { name: "Composer toolbar" });
  const frame = () => region(".sg-composer-canvas-frame");
  const iframe = () => utils.container.querySelector("iframe") as HTMLIFrameElement;

  const renders = () => bridge.posts.filter((p) => asAny(p.message).type === "render");
  const canvasDoc = (): CompositionDocument => asAny(renders().at(-1)!.message).document;
  const lastSentSession = () => asAny(bridge.posts.at(-1)!.message).session;

  /** Add via the shared chooser, opened for `target` from the canvas request-add path. */
  function addAt(target: InsertionTarget, cardName: string) {
    act(() => bridge.deliver(requestAddMessage(rev++, target)));
    fireEvent.click(within(chooser()).getByRole("button", { name: cardName }));
  }

  return {
    bridge,
    ...utils,
    tree,
    inspector,
    chooser,
    toolbar,
    frame,
    iframe,
    canvasDoc,
    lastSentSession,
    addAt,
  };
}

beforeEach(() => localStorage.clear());

describe("ComposerIntegration — cross-surface wiring (#251)", () => {
  it("chooser add drives tree, canvas snapshot, inspector, and selection together", () => {
    const s = setup();
    s.addAt(ROOT, "Box");

    const doc = s.canvasDoc();
    expect(doc.root).toHaveLength(1);
    const boxId = doc.root[0]!.id;
    // Canvas snapshot + selection reflect the new node.
    expect(s.lastSentSession().selectedId).toBe(boxId);
    // Tree shows it, inspector selected it.
    expect(s.tree().querySelector(`[data-sg-tree-node-id="${boxId}"]`)).not.toBeNull();
    expect(within(s.inspector()).getByText("Box")).toBeInTheDocument();
  });

  it("a canvas selection reveals + expands the node's ancestors in the tree", () => {
    const s = setup();
    s.addAt(ROOT, "Split Layout");
    const splitId = s.canvasDoc().root[0]!.id;
    s.addAt({ parentId: splitId, slotId: "left", index: 0 }, "Box");
    const boxId = s.canvasDoc().root[0]!.slots.left![0]!.id;

    // Collapse the split so the box row is not rendered.
    fireEvent.click(within(s.tree()).getByRole("button", { name: /collapse split layout/i }));
    expect(s.tree().querySelector(`[data-sg-tree-node-id="${boxId}"]`)).toBeNull();

    // A canvas click on the (hidden) box reveals it: selects + re-expands split.
    act(() => s.bridge.deliver(selectMessage(rev++, boxId)));
    expect(s.tree().querySelector(`[data-sg-tree-node-id="${boxId}"]`)).not.toBeNull();
    // And the selection is mirrored back to the canvas snapshot.
    expect(s.lastSentSession().selectedId).toBe(boxId);
  });

  it("a cross-frame Add opens the shared chooser for the exact target and restores focus to the iframe", () => {
    const s = setup();
    // Seed one box so we can target an explicit index.
    s.addAt(ROOT, "Box");
    // The canvas requests an add BEFORE the first child (index 0). The host
    // focuses the iframe first, so the chooser captures it as the restore
    // target (the chooser then moves focus to its own search field).
    act(() => s.bridge.deliver(requestAddMessage(rev++, { parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 0 })));
    fireEvent.click(within(s.chooser()).getByRole("button", { name: "Stack" }));

    const doc = s.canvasDoc();
    expect(doc.root.map((n) => n.componentId)).toEqual([FIXTURE_IDS.stack, FIXTURE_IDS.box]);
    // Focus returned to the originating iframe control after the chooser closed.
    expect(document.activeElement).toBe(s.iframe());
  });

  it("a before-first insertion lands at index 0 identically in tree, canvas, and export order", () => {
    const s = setup();
    s.addAt(ROOT, "Stack");
    // Insert before the first child.
    s.addAt({ parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 0 }, "Split Layout");

    // Canvas snapshot order.
    expect(s.canvasDoc().root.map((n) => n.componentId)).toEqual([FIXTURE_IDS.split, FIXTURE_IDS.stack]);
    // Tree order.
    const treeIds = [...s.tree().querySelectorAll("[data-sg-tree-node-id]")].map((el) =>
      el.getAttribute("data-sg-tree-node-id"),
    );
    expect(treeIds.slice(0, 2)).toEqual([s.canvasDoc().root[0]!.id, s.canvasDoc().root[1]!.id]);

    // Export order (same document/manifest source).
    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Export JSX" }));
    const code = screen.getByRole("dialog").querySelector("pre")!.textContent ?? "";
    expect(code).toContain("SplitLayout");
    expect(code).toContain("Stack");
    expect(code.indexOf("SplitLayout")).toBeLessThan(code.indexOf("Stack"));
  });
});

describe("ComposerIntegration — mutations reflect everywhere (#251)", () => {
  it("a prop edit updates the document, the canvas snapshot, and the save status", () => {
    const s = setup();
    s.addAt(ROOT, "Box");
    const boxId = s.canvasDoc().root[0]!.id;

    const label = within(s.inspector()).getByLabelText("Label") as HTMLInputElement;
    fireEvent.input(label, { target: { value: "Renamed" } });

    expect(s.canvasDoc().root[0]!.props.label).toBe("Renamed");
    expect(s.canvasDoc().root[0]!.id).toBe(boxId); // same stable node, not a remount
    expect(within(s.toolbar()).getByText("Saved locally")).toBeInTheDocument();
  });

  it("a sibling move reorders the document across tree + canvas", () => {
    const s = setup();
    s.addAt({ parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 0 }, "Box");
    s.addAt({ parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 1 }, "Stack");
    const [firstId, secondId] = s.canvasDoc().root.map((n) => n.id);

    // Stack is selected (just added); move it up.
    fireEvent.click(within(s.inspector()).getByRole("button", { name: "Move up" }));
    expect(s.canvasDoc().root.map((n) => n.id)).toEqual([secondId, firstId]);
  });

  it("removing a subtree clears it from the tree and the canvas snapshot", () => {
    const s = setup();
    s.addAt(ROOT, "Split Layout");
    const splitId = s.canvasDoc().root[0]!.id;
    s.addAt({ parentId: splitId, slotId: "left", index: 0 }, "Box");

    // Select the split (its select button's accessible name is the bare title),
    // then remove it via the inspector.
    fireEvent.click(within(s.tree()).getByRole("button", { name: "Split Layout" }));
    fireEvent.click(within(s.inspector()).getByRole("button", { name: "Remove" }));

    expect(s.canvasDoc().root).toHaveLength(0);
    expect(s.tree().querySelector("[data-sg-tree-node-id]")).toBeNull();
  });
});

describe("ComposerIntegration — mode, viewport, persistence, export (#251)", () => {
  it("Preview mode removes structural affordances and read-only-locks the inspector", () => {
    const s = setup();
    s.addAt(ROOT, "Box");
    // Edit mode: the tree offers an Add affordance.
    expect(within(s.tree()).getByRole("button", { name: /add component to document root/i })).toBeInTheDocument();

    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Preview" }));

    expect(s.lastSentSession().mode).toBe("preview");
    expect(within(s.tree()).queryByRole("button", { name: /add component to document root/i })).toBeNull();
    // Inspector controls are disabled but the selection/values are preserved.
    expect((within(s.inspector()).getByRole("button", { name: "Remove" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(s.inspector()).getByText("Box")).toBeInTheDocument();
  });

  it("switching Edit → Preview → Edit preserves the document and selection", () => {
    const s = setup();
    s.addAt(ROOT, "Box");
    const boxId = s.canvasDoc().root[0]!.id;
    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Preview" }));
    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Edit" }));
    expect(s.lastSentSession().mode).toBe("edit");
    expect(s.lastSentSession().selectedId).toBe(boxId);
    expect(s.canvasDoc().root).toHaveLength(1);
  });

  it("the viewport control resizes only the preview frame and persists the choice", () => {
    const s = setup();
    expect(s.frame().style.width).toBe(""); // fluid
    fireEvent.change(within(s.toolbar()).getByLabelText("Canvas viewport"), { target: { value: "tablet" } });
    expect(s.frame().style.width).toBe("768px");
    expect(localStorage.getItem(LS_COMPOSER_VIEWPORT)).toBe("tablet");
  });

  it("restores a persisted viewport on load", () => {
    const s = setup("mobile");
    expect(s.frame().style.width).toBe("390px");
  });

  it("Reset sample returns to the native sample document", () => {
    const s = setup();
    s.addAt(ROOT, "Box");
    expect(s.canvasDoc().root).toHaveLength(1);
    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Reset sample" }));
    expect(s.canvasDoc().root).toHaveLength(0);
  });

  it("export renders exactly the generator output for the current document/manifest", () => {
    const s = setup();
    s.addAt(ROOT, "Box");
    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Export JSX" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Export — Integration Doc/)).toBeInTheDocument();
    expect(dialog.querySelector("pre")!.textContent).toContain("Box");
  });
});

describe("ComposerIntegration — replay + guarded keyboard (#251)", () => {
  it("replays the newest document to a reloaded iframe at a fresh revision", () => {
    const s = setup();
    s.addAt(ROOT, "Box");
    const before = s.bridge.posts.length;

    // The iframe reloads and re-announces ready — the newest snapshot replays.
    act(() => s.bridge.deliver(readyMessage()));
    const replay = s.bridge.posts[before]!;
    expect(asAny(replay.message).type).toBe("render");
    expect(asAny(replay.message).document.root).toHaveLength(1);
  });

  it("Delete removes the selected node, but is guarded in inputs and in Preview", () => {
    const s = setup();
    s.addAt(ROOT, "Box");
    expect(s.canvasDoc().root).toHaveLength(1);

    // Guard 1: a keystroke aimed at an editable control does NOT delete.
    const label = within(s.inspector()).getByLabelText("Label");
    fireEvent.keyDown(label, { key: "Delete" });
    expect(s.canvasDoc().root).toHaveLength(1);

    // Guard 2: Preview mode never mutates.
    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Preview" }));
    fireEvent.keyDown(document.body, { key: "Delete" });
    expect(s.canvasDoc().root).toHaveLength(1);

    // Edit mode, focus outside an input → the selected node is removed.
    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(document.body, { key: "Delete" });
    expect(s.canvasDoc().root).toHaveLength(0);
  });
});
