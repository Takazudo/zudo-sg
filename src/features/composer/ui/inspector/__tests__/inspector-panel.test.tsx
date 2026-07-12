/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/preact";
import {
  TEST_COMPONENT_IDS,
  makeDocument,
  makeNode,
  resetTestIds,
  testManifest,
} from "../../test-support/composer-fixtures";
import { InspectorPanel, type InspectorPanelProps } from "../inspector-panel";

function renderPanel(overrides: Partial<InspectorPanelProps> = {}) {
  const onUpdateProps = vi.fn();
  const onReorder = vi.fn();
  const onRemove = vi.fn();
  const utils = render(
    <InspectorPanel
      document={makeDocument([])}
      manifest={testManifest}
      selectedId={null}
      mode="edit"
      onUpdateProps={onUpdateProps}
      onReorder={onReorder}
      onRemove={onRemove}
      {...overrides}
    />,
  );
  return { ...utils, onUpdateProps, onReorder, onRemove };
}

beforeEach(() => {
  resetTestIds();
});

describe("InspectorPanel — root/empty state", () => {
  it("shows an empty-composition note when the document has no nodes", () => {
    renderPanel({ document: makeDocument([]), selectedId: null });
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
    expect(screen.getByText(/composition is empty/i, { selector: "p" })).toBeInTheDocument();
  });

  it("shows a 'select something' note when nodes exist but nothing is selected", () => {
    const doc = makeDocument([makeNode(TEST_COMPONENT_IDS.label, { text: "Hi" })]);
    renderPanel({ document: doc, selectedId: null });
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
    expect(screen.getByText(/select a component/i, { selector: "p" })).toBeInTheDocument();
  });

  it("falls back to the empty state for a stale/unknown selectedId", () => {
    const doc = makeDocument([makeNode(TEST_COMPONENT_IDS.label, { text: "Hi" }, {}, "a")]);
    renderPanel({ document: doc, selectedId: "does-not-exist" });
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
  });
});

describe("InspectorPanel — identity + breadcrumb + slot counts", () => {
  it("shows identity and Root breadcrumb for a top-level node", () => {
    const doc = makeDocument([makeNode(TEST_COMPONENT_IDS.label, { text: "Hi" }, {}, "a")]);
    const { container } = renderPanel({ document: doc, selectedId: "a" });
    const identity = container.querySelector("[data-sg-inspector-identity]")!;
    expect(identity.textContent).toContain(TEST_COMPONENT_IDS.label);
    expect(identity.textContent).toContain("v1");
    const breadcrumb = screen.getByRole("navigation", { name: /selected component location/i });
    expect(breadcrumb.textContent).toContain("Root");
  });

  it("uses titleFor for a friendlier identity + breadcrumb label when supplied", () => {
    const doc = makeDocument([
      makeNode(
        TEST_COMPONENT_IDS.panel,
        {},
        { left: [makeNode(TEST_COMPONENT_IDS.label, { text: "Hi" }, {}, "child")] },
        "panel",
      ),
    ]);
    renderPanel({
      document: doc,
      selectedId: "child",
      titleFor: (id) => (id === TEST_COMPONENT_IDS.panel ? "Split Panel" : undefined),
    });
    const breadcrumb = screen.getByRole("navigation", { name: /selected component location/i });
    const items = within(breadcrumb).getAllByRole("listitem");
    expect(items.map((li) => li.textContent).join(" | ")).toContain("Split Panel › Left");
  });

  it("shows slot counts for a container node", () => {
    const doc = makeDocument([
      makeNode(
        TEST_COMPONENT_IDS.panel,
        {},
        {
          left: [makeNode(TEST_COMPONENT_IDS.label, { text: "A" })],
          right: [makeNode(TEST_COMPONENT_IDS.label, { text: "B" }), makeNode(TEST_COMPONENT_IDS.label, { text: "C" })],
        },
        "panel",
      ),
    ]);
    const { container } = renderPanel({ document: doc, selectedId: "panel" });
    const items = Array.from(container.querySelectorAll("[data-sg-inspector-slots] li")).map(
      (li) => li.textContent,
    );
    expect(items).toEqual(["Left — 1 child (single)", "Right — 2 children"]);
  });
});

describe("InspectorPanel — field rendering + commits", () => {
  function widgetDoc() {
    return makeDocument([
      makeNode(
        TEST_COMPONENT_IDS.widget,
        { title: "Untitled", note: "n", enabled: true, count: 3, variant: "solid", tint: "#336699" },
        {},
        "w",
      ),
    ]);
  }

  it("renders one control per declared field kind", () => {
    renderPanel({ document: widgetDoc(), selectedId: "w" });
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    expect(screen.getByLabelText("Note").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Enabled")).toBeInTheDocument();
    expect(screen.getByLabelText("Enabled")).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText("Count")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Variant").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Tint")).toHaveAttribute("type", "text");
  });

  it("commits a text field edit through onUpdateProps with the node id + prop patch", () => {
    const { onUpdateProps } = renderPanel({ document: widgetDoc(), selectedId: "w" });
    fireEvent.input(screen.getByLabelText("Title"), { target: { value: "New title" } });
    expect(onUpdateProps).toHaveBeenCalledWith("w", { title: "New title" });
  });

  it("commits a boolean field edit with a real boolean", () => {
    const { onUpdateProps } = renderPanel({ document: widgetDoc(), selectedId: "w" });
    fireEvent.click(screen.getByLabelText("Enabled"));
    expect(onUpdateProps).toHaveBeenCalledWith("w", { enabled: false });
  });

  it("commits a select field edit", () => {
    const { onUpdateProps } = renderPanel({ document: widgetDoc(), selectedId: "w" });
    fireEvent.change(screen.getByLabelText("Variant"), { target: { value: "ghost" } });
    expect(onUpdateProps).toHaveBeenCalledWith("w", { variant: "ghost" });
  });

  it("commits a color field edit as a string", () => {
    const { onUpdateProps } = renderPanel({ document: widgetDoc(), selectedId: "w" });
    fireEvent.input(screen.getByLabelText("Tint"), { target: { value: "#ff0000" } });
    expect(onUpdateProps).toHaveBeenCalledWith("w", { tint: "#ff0000" });
  });

  it("commits a valid numeric edit as a number, not a string", () => {
    const { onUpdateProps } = renderPanel({ document: widgetDoc(), selectedId: "w" });
    fireEvent.input(screen.getByLabelText("Count"), { target: { value: "7" } });
    expect(onUpdateProps).toHaveBeenCalledWith("w", { count: 7 });
    expect(typeof onUpdateProps.mock.calls[0]![1].count).toBe("number");
  });

  it("never commits NaN and shows a labelled inline error for invalid numeric drafts", () => {
    // A native <input type="number"> coerces non-numeric text to an empty
    // `.value` per the HTML spec (never lets "abc" reach the DOM value) —
    // the empty-draft branch is what real invalid typing hits.
    const { onUpdateProps } = renderPanel({ document: widgetDoc(), selectedId: "w" });
    const countInput = screen.getByLabelText("Count");
    fireEvent.input(countInput, { target: { value: "abc" } });
    expect(onUpdateProps).not.toHaveBeenCalled();
    expect(countInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = countInput.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)).toHaveTextContent(/enter a number/i);
  });

  it("rejects an out-of-range numeric draft with a labelled error and no commit", () => {
    const { onUpdateProps } = renderPanel({ document: widgetDoc(), selectedId: "w" });
    const countInput = screen.getByLabelText("Count");
    fireEvent.input(countInput, { target: { value: "99" } });
    expect(onUpdateProps).not.toHaveBeenCalled();
    expect(countInput).toHaveAttribute("aria-invalid", "true");
  });

  it("reverts an invalid numeric draft to the last valid value on blur", () => {
    renderPanel({ document: widgetDoc(), selectedId: "w" });
    const countInput = screen.getByLabelText("Count") as HTMLInputElement;
    fireEvent.input(countInput, { target: { value: "" } });
    expect(countInput).toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(countInput);
    expect(countInput.value).toBe("3");
    expect(countInput).not.toHaveAttribute("aria-invalid", "true");
  });
});

describe("InspectorPanel — read-only / preview mode", () => {
  it("disables every field control and the move/remove actions while keeping values visible", () => {
    const doc = makeDocument([
      makeNode(TEST_COMPONENT_IDS.widget, { title: "Locked", note: "n", enabled: true, count: 3, variant: "solid", tint: "#000" }, {}, "w"),
    ]);
    renderPanel({ document: doc, selectedId: "w", mode: "preview" });
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveValue("Locked");
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByText(/preview mode/i, { selector: "p" })).toBeInTheDocument();
  });
});

describe("InspectorPanel — opaque nodes", () => {
  it("shows diagnostics + raw identity, no editable fields, but allows move/remove", () => {
    const doc = makeDocument([makeNode("unknown.thing", { anything: "x" }, {}, "ghost")]);
    const { container, onRemove } = renderPanel({ document: doc, selectedId: "ghost" });

    const identity = container.querySelector("[data-sg-inspector-identity]")!;
    expect(identity.textContent).toContain("unknown.thing");
    expect(screen.getByText(/can't be edited/i, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/unknown component/i, { selector: "li" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("ghost");

    // Single top-level node: nothing to move up/down into.
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
  });

  it("enables sibling move for an opaque node with siblings", () => {
    const doc = makeDocument([
      makeNode(TEST_COMPONENT_IDS.label, { text: "A" }, {}, "a"),
      makeNode("unknown.thing", {}, {}, "ghost"),
    ]);
    const { onReorder } = renderPanel({ document: doc, selectedId: "ghost" });
    const upButton = screen.getByRole("button", { name: "Move up" });
    expect(upButton).not.toBeDisabled();
    fireEvent.click(upButton);
    expect(onReorder).toHaveBeenCalledWith("ghost", "up");
  });
});

describe("InspectorPanel — DOM scoping sanity", () => {
  it("does not leak diagnostics markup when the node is editable", () => {
    const doc = makeDocument([makeNode(TEST_COMPONENT_IDS.label, { text: "Hi" }, {}, "a")]);
    const { container } = renderPanel({ document: doc, selectedId: "a" });
    expect(within(container).queryByRole("alert")).not.toBeInTheDocument();
  });
});
