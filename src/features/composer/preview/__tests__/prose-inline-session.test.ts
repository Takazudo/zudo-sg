// The explicit-save prose session, wired to real DOM (issue #375, epic #368).
//
// Runs against the REAL registry entry for `ui.prose-md` — the contract marker
// that routes a field here (`inlineEdit.mode: "markdown-source"`) lives on that
// entry, so a stubbed lookalike would prove nothing about which session a real
// component actually gets.
//
// The property under test throughout: NO IMPLICIT COMMITS. Only the floating
// Save button and the leave dialog's explicit Save reach `onCommitInlineEdit`;
// every other way out either prompts or silently discards.

import { describe, expect, it, vi } from "vitest";
import { h } from "preact";
import { fireEvent, render } from "@testing-library/preact";
import type { CompositionDocument, CompositionNode } from "@/composer";
import { COMPOSITION_SCHEMA_VERSION } from "@/composer";
import { composerEntries } from "@/styleguide/data/composer-registry";
import { CompositionCanvas, type CompositionCanvasProps } from "../renderer";
import type { PreviewSession } from "../protocol";

const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };

const SOURCE = "## Title\n\nBody copy.";

function node(
  id: string,
  componentId: string,
  props: CompositionNode["props"] = {},
  slots: CompositionNode["slots"] = {},
): CompositionNode {
  return { id, componentId, componentVersion: 1, props, slots };
}

function doc(root: CompositionNode[]): CompositionDocument {
  return { schemaVersion: COMPOSITION_SCHEMA_VERSION, id: "t", name: "Test", root };
}

/** A prose-md block plus a plain (auto-commit) prose-p block beside it. */
function fixture(markdown = SOURCE): CompositionDocument {
  return doc([
    node("md-1", "ui.prose-md", { markdown }),
    node("p-1", "ui.prose-p", { children: "Plain paragraph." }),
  ]);
}

const EDITOR = "[data-zc-prose-editing]";
const DIALOG = '[role="dialog"]';

function draw(document: CompositionDocument, overrides: Partial<CompositionCanvasProps> = {}) {
  const onCommitInlineEdit = vi.fn();
  const onSelect = vi.fn();
  const props: CompositionCanvasProps = {
    document,
    entries: composerEntries,
    session: EDIT,
    onSelect,
    onRequestAdd: vi.fn(),
    onRequestNodeMenu: vi.fn(),
    onRequestInsertMenu: vi.fn(),
    onCommitInlineEdit,
    ...overrides,
  };
  const utils = render(h(CompositionCanvas, props));
  const redraw = (next: Partial<CompositionCanvasProps>) =>
    utils.rerender(h(CompositionCanvas, { ...props, ...next }));
  return { ...utils, props, onCommitInlineEdit, onSelect, redraw };
}

/** Enter a prose session on `nodeId` via the double-click gesture. */
function open(document = fixture(), overrides: Partial<CompositionCanvasProps> = {}) {
  const drawn = draw(document, overrides);
  fireEvent.dblClick(drawn.container.querySelector('[data-zc-node-id="md-1"] .zc-prose-md')!);
  return drawn;
}

function editorOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(EDITOR);
}

/** Type into the raw-source editable the way a browser would report it. */
function type(editor: HTMLElement, value: string): void {
  editor.textContent = value;
  fireEvent.input(editor);
}

/**
 * Focus leaving for HOST chrome, the way a browser actually reports it: a
 * focusout with no in-iframe successor, focus genuinely gone from this document
 * — its `activeElement` back on `<body>`, because the focus moved WITHIN the
 * same top-level context — and the verdict taken one task later.
 *
 * Every part matters. The session DEFERS its verdict by exactly one task,
 * because an incoming render that relocates the edited node blurs the editable
 * too and is otherwise indistinguishable at dispatch time (see `onFocusOut` in
 * `prose-inline-session.ts`); `hasFocus()` is what separates them, and it is
 * only decisive after the host's focus change has propagated. A test that
 * fired the event and asserted immediately would be asserting nothing. The
 * `activeElement` reset is what separates this from `leaveForAnotherWindow`.
 */
async function leaveForHostChrome(editor: HTMLElement): Promise<void> {
  const ownerDoc = editor.ownerDocument;
  const original = ownerDoc.hasFocus;
  ownerDoc.hasFocus = () => false;
  try {
    editor.blur();
    fireEvent.focusOut(editor, { relatedTarget: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    ownerDoc.hasFocus = original;
  }
}

/**
 * The user alt-tabbing to another window (or switching tabs): the SAME
 * focusout with a null `relatedTarget` and the same `hasFocus()` false — but
 * the focus path into this document is retained, so the editable is still its
 * `activeElement`. Leaving the browser is not leaving the block.
 */
async function leaveForAnotherWindow(editor: HTMLElement): Promise<void> {
  const ownerDoc = editor.ownerDocument;
  const original = ownerDoc.hasFocus;
  ownerDoc.hasFocus = () => false;
  try {
    editor.focus();
    fireEvent.focusOut(editor, { relatedTarget: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    ownerDoc.hasFocus = original;
  }
}

/** The dialog button whose visible label matches. */
function action(container: HTMLElement, label: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>("[data-zc-dialog-action]")].find(
    (button) => button.textContent === label,
  );
  expect(found, `expected a "${label}" dialog action`).toBeDefined();
  return found!;
}

describe("entering a markdown-source session", () => {
  it("replaces the component body with a plaintext editable holding the RAW source", () => {
    const { container } = open();
    const editor = editorOf(container)!;
    expect(editor).not.toBeNull();
    // Raw markdown, not the rendered HTML — the plain-text walker is not a
    // markdown serializer, so what is edited must be the source itself.
    expect(editor.textContent).toBe(SOURCE);
    expect(editor.getAttribute("contenteditable")).toBe("plaintext-only");
    // The component is NOT rendered underneath it.
    expect(container.querySelector('[data-zc-node-id="md-1"] .zc-prose-md')).toBeNull();
    // Both sessions share the "an editable is live here" marker the canvas's
    // capture-phase activation swallow keys off.
    expect(editor.hasAttribute("data-zc-inline-editing")).toBe(true);
  });

  it("shows the Save affordance, initially in its NOT-dirty state", () => {
    const { container } = open();
    const save = container.querySelector<HTMLElement>(".zc-prose-save")!;
    expect(save).not.toBeNull();
    expect(save.hasAttribute("data-zc-dirty")).toBe(false);
    expect(container.querySelector(".zc-prose-savebar-status")).toBeNull();
  });

  it("marks the Save affordance dirty once the value diverges, and clean again on undo", () => {
    const { container } = open();
    const editor = editorOf(container)!;
    type(editor, `${SOURCE}\n\nMore.`);
    expect(container.querySelector(".zc-prose-save")!.hasAttribute("data-zc-dirty")).toBe(true);
    expect(container.querySelector(".zc-prose-savebar-status")!.textContent).toBe("Unsaved changes");
    // Dirtiness is DERIVED, so typing back to the start value clears it.
    type(editor, SOURCE);
    expect(container.querySelector(".zc-prose-save")!.hasAttribute("data-zc-dirty")).toBe(false);
  });

  it("REFUSES an opaque node — its preserved payload is read-only", () => {
    // An unsupported component version makes the node opaque (#245): the canvas
    // shows its payload verbatim and the model rejects prop updates, so an
    // editor there could only ever produce an edit the user loses.
    const stale = doc([node("md-1", "ui.prose-md", { markdown: SOURCE })]);
    stale.root[0]!.componentVersion = 99;
    const { container, onSelect } = draw(stale);
    fireEvent.dblClick(container.querySelector('[data-zc-node-id="md-1"] .zc-opaque')!);
    expect(container.querySelector(EDITOR)).toBeNull();
    expect(container.querySelector(".zc-prose-savebar")).toBeNull();
    // …and the payload disclosure is still there.
    expect(container.querySelector('[data-zc-node-id="md-1"] .zc-opaque')).not.toBeNull();
    expect(onSelect).not.toHaveBeenCalledWith(null);
  });

  it("opens on click-again on the already-SELECTED node too", () => {
    const { container } = draw(fixture(), { session: { ...EDIT, selectedId: "md-1" } });
    fireEvent.click(container.querySelector('[data-zc-node-id="md-1"] .zc-prose-md')!);
    expect(editorOf(container)).not.toBeNull();
  });

  it("suppresses the REST of the entry gesture so it cannot select in the fresh source", () => {
    // Entering from an already-selected node consumes the FIRST click of a
    // double-click, so the second one lands on raw markdown that replaced what
    // the user was pointing at — and its word-select would put a selection at
    // an unrelated offset that the next keystroke replaces. A continuation
    // carries `detail >= 2`; a genuinely new gesture restarts at 1.
    const { container } = draw(fixture(), { session: { ...EDIT, selectedId: "md-1" } });
    fireEvent.click(container.querySelector('[data-zc-node-id="md-1"] .zc-prose-md')!);
    const editor = editorOf(container)!;

    const continuation = fireEvent.mouseDown(editor, { detail: 2 });
    expect(continuation, "the entry gesture's second click is swallowed").toBe(false);

    // A fresh click disarms the guard; from then on double-click behaves
    // normally inside what is now an ordinary source editor.
    expect(fireEvent.mouseDown(editor, { detail: 1 })).toBe(true);
    expect(fireEvent.mouseDown(editor, { detail: 2 })).toBe(true);
  });
});

describe("no implicit commits", () => {
  it("Enter does NOT commit — it types a newline into the source", () => {
    const { container, onCommitInlineEdit } = open();
    const editor = editorOf(container)!;
    type(editor, `${SOURCE}\n`);
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    expect(editorOf(container)).not.toBeNull(); // session still open
  });

  it("losing focus PROMPTS instead of committing (the plain session's blur-commits rule does not apply)", async () => {
    const { container, onCommitInlineEdit } = open();
    const editor = editorOf(container)!;
    type(editor, "changed");
    // Focus leaving the iframe with no in-iframe successor: the observable
    // signal for a click on HOST chrome (toolbar / inspector / tree).
    await leaveForHostChrome(editor);
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    expect(container.querySelector(DIALOG)).not.toBeNull();
  });

  it("a blur that never left the frame is a re-render, not a departure", async () => {
    // An incoming render that MOVES the edited node rebuilds its DOM and blurs
    // the editable on the way — no user gesture, and the ground-check has
    // already decided the session survives. Prompting here would put a leave
    // dialog on screen that the user never asked for, and answering it Discard
    // would throw away a draft nothing threatened.
    const { container, onCommitInlineEdit } = open();
    const editor = editorOf(container)!;
    type(editor, "still mine");
    fireEvent.focusOut(editor, { relatedTarget: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)!.textContent).toBe("still mine");
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("does NOT read a window/tab blur as leaving the block", async () => {
    // Alt-tabbing away (to copy some markdown out of another window, say)
    // reports exactly what a click on host chrome does — a focusout with no
    // successor and `hasFocus()` false. Prompting here would pop a modal
    // nobody asked for and pull the tab back to the front to show it.
    const { container, onCommitInlineEdit } = open();
    const editor = editorOf(container)!;
    type(editor, "typed before switching windows");
    await leaveForAnotherWindow(editor);

    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)!.textContent).toBe("typed before switching windows");
    expect(container.ownerDocument.activeElement).toBe(editor);
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("switching to Preview does NOT commit — it stashes and prompts", () => {
    const document = fixture();
    const { container, onCommitInlineEdit, redraw } = open(document);
    type(editorOf(container)!, "changed");
    redraw({ session: { ...EDIT, mode: "preview" } });
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    // Stashed: the editable is gone, the draft lives in the machine.
    expect(editorOf(container)).toBeNull();
    expect(container.querySelector(DIALOG)).not.toBeNull();
  });
});

describe("the Save button", () => {
  it("commits exactly once, with the SESSION-START revision", () => {
    const document = fixture();
    const { container, onCommitInlineEdit, redraw } = open(document, { revision: 4 });
    type(editorOf(container)!, "# Rewritten");
    // A render lands mid-edit and bumps the revision. The commit must still
    // carry the revision captured at session START (issue #288's invariant), so
    // the host's staleness gate can reject it.
    redraw({ revision: 9 });
    fireEvent.click(container.querySelector(".zc-prose-save")!);
    expect(onCommitInlineEdit).toHaveBeenCalledTimes(1);
    expect(onCommitInlineEdit).toHaveBeenCalledWith("md-1", "markdown", "# Rewritten", 4);
    expect(editorOf(container)).toBeNull();
    expect(container.querySelector(".zc-prose-savebar")).toBeNull();
  });

  it("does NOT commit an unchanged value — it just ends the session", () => {
    // A no-op commit still advances the document revision host-side, which
    // would poison a later real commit's session-start staleness gate.
    const { container, onCommitInlineEdit } = open();
    fireEvent.click(container.querySelector(".zc-prose-save")!);
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    expect(editorOf(container)).toBeNull();
  });

  it("suppresses its own mousedown so clicking it cannot read as a click-away", () => {
    const { container } = open();
    type(editorOf(container)!, "changed");
    const cancelled = !fireEvent.mouseDown(container.querySelector(".zc-prose-save")!);
    expect(cancelled).toBe(true);
    // No leave dialog was raised by the gesture.
    expect(container.querySelector(DIALOG)).toBeNull();
  });
});

describe("ESC", () => {
  it("PROMPTS while dirty; Keep editing restores the editor with the draft intact", () => {
    const { container, onCommitInlineEdit } = open();
    type(editorOf(container)!, "draft text");
    fireEvent.keyDown(editorOf(container)!, { key: "Escape" });

    const dialog = container.querySelector(DIALOG)!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // ESC is a discard gesture — the dialog confirms it, it never offers Save.
    const labels = [...dialog.querySelectorAll("[data-zc-dialog-action]")].map((b) => b.textContent);
    expect(labels).toEqual(["Discard changes", "Keep editing"]);

    fireEvent.click(action(container, "Keep editing"));
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)!.textContent).toBe("draft text");
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("Discard reverts to the document value and never commits", () => {
    const { container, onCommitInlineEdit } = open();
    type(editorOf(container)!, "draft text");
    fireEvent.keyDown(editorOf(container)!, { key: "Escape" });
    fireEvent.click(action(container, "Discard changes"));
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    expect(editorOf(container)).toBeNull();
    // The real component is back, rendering the untouched source.
    expect(container.querySelector('[data-zc-node-id="md-1"] .zc-prose-md')).not.toBeNull();
  });

  it("exits SILENTLY when the draft is clean — nothing to confirm", () => {
    const { container, onCommitInlineEdit } = open();
    fireEvent.keyDown(editorOf(container)!, { key: "Escape" });
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).toBeNull();
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("is IGNORED mid-composition — that ESC belongs to the IME, not the session", () => {
    const { container } = open();
    const editor = editorOf(container)!;
    fireEvent.compositionStart(editor);
    type(editor, `${SOURCE}あ`);
    fireEvent.keyDown(editor, { key: "Escape", isComposing: true });
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).not.toBeNull();
    // …and the session is still live for a real ESC once composition ends.
    fireEvent.compositionEnd(editor);
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(container.querySelector(DIALOG)).not.toBeNull();
  });

  it("keeps composed text out of any stray commit while composing", () => {
    const { container, onCommitInlineEdit } = open();
    const editor = editorOf(container)!;
    fireEvent.compositionStart(editor);
    type(editor, "にほんご");
    fireEvent.keyDown(editor, { key: "Enter", keyCode: 229 });
    fireEvent.compositionEnd(editor);
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    // The confirmed candidate IS the draft, so an explicit save carries it.
    fireEvent.click(container.querySelector(".zc-prose-save")!);
    expect(onCommitInlineEdit).toHaveBeenCalledWith("md-1", "markdown", "にほんご", 0);
  });
});

describe("clicking away", () => {
  it("PROMPTS at mousedown while dirty, and CONSUMES the gesture (no selection change)", () => {
    const { container, onSelect, onCommitInlineEdit } = open();
    type(editorOf(container)!, "changed");
    onSelect.mockClear();

    const other = container.querySelector('[data-zc-node-id="p-1"] p')!;
    // Intercepted at mousedown in the CAPTURE phase — before focus moves.
    const notCancelled = fireEvent.mouseDown(other);
    expect(notCancelled).toBe(false);

    const dialog = container.querySelector(DIALOG)!;
    expect(dialog).not.toBeNull();
    const labels = [...dialog.querySelectorAll("[data-zc-dialog-action]")].map((b) => b.textContent);
    expect(labels).toEqual(["Discard changes", "Keep editing", "Save changes"]);

    // The triggering click is consumed, never replayed: the user re-clicks
    // their target after answering.
    fireEvent.click(other);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("exits SILENTLY while clean, and the click through to selection still works", () => {
    const { container, onSelect } = open();
    onSelect.mockClear();
    const other = container.querySelector('[data-zc-node-id="p-1"] p')!;
    fireEvent.mouseDown(other);
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).toBeNull();
    fireEvent.click(other);
    expect(onSelect).toHaveBeenCalledWith("p-1");
  });

  it.each<[string, number]>([
    ["a right-click", 2],
    ["a middle-click", 1],
  ])("ignores %s outside the editable — only a primary press is an intent to leave", (_l, button) => {
    // A right-click is how the user reaches the browser's own Paste menu, and
    // `preventDefault` on mousedown does not suppress the `contextmenu` that
    // follows — so treating it as a departure would put the modal AND the
    // context menu on screen together.
    const { container, onCommitInlineEdit } = open();
    type(editorOf(container)!, "changed");
    const notCancelled = fireEvent.mouseDown(
      container.querySelector('[data-zc-node-id="p-1"] p')!,
      { button },
    );
    expect(notCancelled).toBe(true);
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)!.textContent).toBe("changed");
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("does not treat a click INSIDE the editable as leaving (caret placement)", () => {
    const { container } = open();
    const editor = editorOf(container)!;
    type(editor, "changed");
    fireEvent.mouseDown(editor);
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).not.toBeNull();
  });

  it("leave-dialog Save commits through the SAME single commit path", () => {
    const { container, onCommitInlineEdit } = open(fixture(), { revision: 3 });
    type(editorOf(container)!, "committed via dialog");
    fireEvent.mouseDown(container.querySelector('[data-zc-node-id="p-1"] p')!);
    fireEvent.click(action(container, "Save changes"));
    expect(onCommitInlineEdit).toHaveBeenCalledTimes(1);
    expect(onCommitInlineEdit).toHaveBeenCalledWith("md-1", "markdown", "committed via dialog", 3);
    expect(container.querySelector(DIALOG)).toBeNull();
  });

  it("leave-dialog Discard drops the draft without committing", async () => {
    const { container, onCommitInlineEdit } = open();
    type(editorOf(container)!, "abandoned");
    await leaveForHostChrome(editorOf(container)!);
    fireEvent.click(action(container, "Discard changes"));
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    expect(editorOf(container)).toBeNull();
  });
});

describe("mode switch with a dirty draft", () => {
  it("stashes, then RESTORES the editor and Edit mode on Keep editing", () => {
    const { container, redraw, onCommitInlineEdit } = open();
    type(editorOf(container)!, "stashed draft");
    redraw({ session: { ...EDIT, mode: "preview" } });

    expect(editorOf(container)).toBeNull();
    const canvas = container.querySelector("[data-composer-canvas]")!;
    expect(canvas.getAttribute("data-mode")).toBe("preview");

    fireEvent.click(action(container, "Keep editing"));

    // Re-mounted from the STASHED draft, not from the document value…
    expect(editorOf(container)!.textContent).toBe("stashed draft");
    // …and the canvas is back in Edit mode, without any new protocol message.
    expect(canvas.getAttribute("data-mode")).toBe("edit");
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("commits the STASHED draft with the session-start revision on Save", () => {
    const { container, redraw, onCommitInlineEdit } = open(fixture(), { revision: 2 });
    type(editorOf(container)!, "stashed then saved");
    redraw({ session: { ...EDIT, mode: "preview" } });
    fireEvent.click(action(container, "Save changes"));
    expect(onCommitInlineEdit).toHaveBeenCalledWith("md-1", "markdown", "stashed then saved", 2);
  });

  it("leaves SILENTLY when the draft is clean", () => {
    const { container, redraw, onCommitInlineEdit } = open();
    redraw({ session: { ...EDIT, mode: "preview" } });
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).toBeNull();
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });
});

describe("the ground moving under the session", () => {
  it("discards SILENTLY when an incoming render changes the edited field", () => {
    const { container, redraw, onCommitInlineEdit } = open();
    type(editorOf(container)!, "doomed draft");
    redraw({ document: fixture("## Changed elsewhere"), revision: 1 });
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).toBeNull();
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("SURVIVES a render that leaves the edited field alone", () => {
    const { container, redraw } = open();
    type(editorOf(container)!, "still mine");
    const elsewhere = doc([
      node("md-1", "ui.prose-md", { markdown: SOURCE }),
      node("p-1", "ui.prose-p", { children: "Edited elsewhere." }),
    ]);
    redraw({ document: elsewhere, revision: 1 });
    expect(editorOf(container)!.textContent).toBe("still mine");
  });

  it("re-establishes the editor when a MOVE rebuilds the node's DOM under a new parent", () => {
    // The field value is untouched, so the ground-check deliberately keeps the
    // session alive — but Preact builds the node afresh under its new parent,
    // destroying the live editable. The session must follow it, not stay bound
    // to a detached node.
    const { container, redraw } = open();
    const editor = editorOf(container)!;
    type(editor, "moved draft");

    const moved = doc([
      node("stack-1", "ui.stack", { gap: "md" }, {
        content: [node("md-1", "ui.prose-md", { markdown: SOURCE })],
      }),
      node("p-1", "ui.prose-p", { children: "Plain paragraph." }),
    ]);
    redraw({ document: moved, revision: 1 });

    const relocated = editorOf(container)!;
    expect(relocated).not.toBeNull();
    expect(relocated).not.toBe(editor); // a genuinely different element
    expect(relocated.textContent).toBe("moved draft");
    expect(relocated.getAttribute("contenteditable")).toBe("plaintext-only");
    // Live again: typing still reaches the machine.
    type(relocated, "typed after the move");
    expect(container.querySelector(".zc-prose-save")!.hasAttribute("data-zc-dirty")).toBe(true);
  });

  it("discards SILENTLY when the edited node leaves the document", () => {
    const { container, redraw, onCommitInlineEdit } = open();
    type(editorOf(container)!, "orphaned");
    redraw({ document: doc([node("p-1", "ui.prose-p", { children: "Alone." })]), revision: 1 });
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).toBeNull();
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });
});

// ── A commit the host would reject is never sent ────────────────────────────
//
// The host drops a commit stamped with a revision it has moved past (#288) and
// answers with nothing — while the commit itself has already torn the editor
// down. Sending one would trade the user's text for an edit that never lands.

describe("saving after the canvas changed underneath", () => {
  /** The same doc with an edit on the OTHER node — a host gesture elsewhere. */
  const elsewhere = () =>
    doc([
      node("md-1", "ui.prose-md", { markdown: SOURCE }),
      node("p-1", "ui.prose-p", { children: "Moved / deleted / undone elsewhere." }),
    ]);

  it("prompts instead of committing, and the draft is still there afterwards", () => {
    const { container, onCommitInlineEdit, redraw } = open(fixture(), { revision: 0 });
    type(editorOf(container)!, "hard-won draft");
    // The host applied a gesture on another node and re-rendered: this field is
    // untouched so the session lives on, but the revision the commit carries is
    // now behind the host's.
    redraw({ document: elsewhere(), revision: 1 });
    expect(editorOf(container)!.textContent).toBe("hard-won draft");

    fireEvent.click(container.querySelector(".zc-prose-save")!);

    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    const dialog = container.querySelector(DIALOG)!;
    expect(dialog).not.toBeNull();
    // No Save option: it could not succeed. Keep editing is the way back to
    // the text, which is what makes the failure non-destructive.
    expect([...dialog.querySelectorAll("[data-zc-dialog-action]")].map((b) => b.textContent)).toEqual(
      ["Discard changes", "Keep editing"],
    );

    fireEvent.click(action(container, "Keep editing"));
    expect(editorOf(container)!.textContent).toBe("hard-won draft");
  });

  it("replaces the leave dialog's Save with the same prompt rather than losing the draft", () => {
    // The review case end to end: a host gesture raises the leave dialog AND
    // bumps the revision, so "Save changes" was both doomed and destructive.
    const { container, onCommitInlineEdit, redraw } = open(fixture(), { revision: 0 });
    type(editorOf(container)!, "draft the dialog is about to eat");
    fireEvent.mouseDown(container.querySelector('[data-zc-node-id="p-1"] p')!);
    expect(action(container, "Save changes")).toBeDefined();
    redraw({ document: elsewhere(), revision: 1 });

    fireEvent.click(action(container, "Save changes"));

    expect(onCommitInlineEdit).not.toHaveBeenCalled();
    expect(container.querySelector(DIALOG)).not.toBeNull();
    expect([...container.querySelectorAll("[data-zc-dialog-action]")].map((b) => b.textContent)).toEqual(
      ["Discard changes", "Keep editing"],
    );

    fireEvent.click(action(container, "Keep editing"));
    expect(editorOf(container)!.textContent).toBe("draft the dialog is about to eat");
  });

  it("still discards a CLEAN session silently — a stale no-op is nothing to warn about", () => {
    const { container, onCommitInlineEdit, redraw } = open(fixture(), { revision: 0 });
    redraw({ document: elsewhere(), revision: 1 });
    fireEvent.click(container.querySelector(".zc-prose-save")!);
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)).toBeNull();
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });
});

describe("dialog accessibility", () => {
  it("is a modal dialog whose initial focus is the SAFE action", () => {
    const { container } = open();
    type(editorOf(container)!, "changed");
    fireEvent.keyDown(editorOf(container)!, { key: "Escape" });
    const dialog = container.querySelector(DIALOG)!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(container.ownerDocument.activeElement).toBe(action(container, "Keep editing"));
  });

  it("contains Tab within its own actions", () => {
    const { container } = open();
    type(editorOf(container)!, "changed");
    fireEvent.mouseDown(container.querySelector('[data-zc-node-id="p-1"] p')!);
    const first = action(container, "Discard changes");
    const last = action(container, "Save changes");

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(container.ownerDocument.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(container.ownerDocument.activeElement).toBe(last);
  });

  it("treats ESC inside the dialog as Keep editing", () => {
    const { container, onCommitInlineEdit } = open();
    type(editorOf(container)!, "kept");
    fireEvent.mouseDown(container.querySelector('[data-zc-node-id="p-1"] p')!);
    fireEvent.keyDown(container.querySelector(DIALOG)!, { key: "Escape" });
    expect(container.querySelector(DIALOG)).toBeNull();
    expect(editorOf(container)!.textContent).toBe("kept");
    expect(onCommitInlineEdit).not.toHaveBeenCalled();
  });

  it("hides the Save bar while a dialog owns the decision", () => {
    const { container } = open();
    type(editorOf(container)!, "changed");
    fireEvent.keyDown(editorOf(container)!, { key: "Escape" });
    expect(container.querySelector(".zc-prose-savebar")).toBeNull();
    fireEvent.click(action(container, "Keep editing"));
    expect(container.querySelector(".zc-prose-savebar")).not.toBeNull();
  });
});

// ── The parallel path stays parallel ────────────────────────────────────────

describe("the plain auto-commit session is untouched", () => {
  it("still opens on a `plain` field and still commits on blur", () => {
    const { container, onCommitInlineEdit } = draw(fixture(), {
      session: { ...EDIT, selectedId: "p-1" },
    });
    fireEvent.click(container.querySelector('[data-zc-node-id="p-1"] p')!);
    const editable = container.querySelector<HTMLElement>(
      '[data-zc-node-id="p-1"] [data-zc-inline-editing]',
    )!;
    expect(editable).not.toBeNull();
    // The plain session edits the COMPONENT's own element, not a source editor.
    expect(editable.hasAttribute("data-zc-prose-editing")).toBe(false);
    expect(editable.tagName).toBe("P");

    editable.textContent = "Reworded.";
    fireEvent.blur(editable);
    expect(onCommitInlineEdit).toHaveBeenCalledWith("p-1", "children", "Reworded.", 0);
  });

  it("never claims a markdown-source field, and never shows prose chrome for a plain one", () => {
    const { container } = draw(fixture(), { session: { ...EDIT, selectedId: "p-1" } });
    fireEvent.click(container.querySelector('[data-zc-node-id="p-1"] p')!);
    expect(container.querySelector(".zc-prose-savebar")).toBeNull();
    expect(container.querySelector(EDITOR)).toBeNull();
  });

  it("opens the PROSE session (not the plain one) on a markdown-source field", () => {
    const { container } = open();
    // The prose editor exists; no component-hosted plain editable does.
    expect(editorOf(container)).not.toBeNull();
    expect(container.querySelectorAll("[data-zc-inline-editing]")).toHaveLength(1);
  });
});
