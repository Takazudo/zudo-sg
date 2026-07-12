/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/preact";
import { ComposerTree } from "../composer-tree";
import { fixtureCatalog, fixtureDocument, fixtureNode, makeAbcDocument, resetFixtureIds, FIXTURE_IDS } from "./fixtures";

function baseProps() {
  return {
    manifest: fixtureCatalog,
    selectedId: null as string | null,
    expandedIds: new Set<string>(),
    onSelect: vi.fn(),
    onReveal: vi.fn(),
    onToggleExpanded: vi.fn(),
    onOpenChooser: vi.fn(),
    onReorder: vi.fn(),
    onRemove: vi.fn(),
  };
}

describe("ComposerTree — structure", () => {
  it("renders the virtual document-root row as an insertion target only", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    render(<ComposerTree document={document} {...baseProps()} />);
    expect(screen.getByText("Document root")).toBeInTheDocument();
  });

  it("renders named left/right slots with B then C in right, in exact order", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const { container } = render(
      <ComposerTree document={document} {...baseProps()} expandedIds={new Set(["split"])} />,
    );
    expect(screen.getByText("Left", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Right", { exact: false })).toBeInTheDocument();

    const rightSlot = container.querySelector('[data-sg-tree-slot-id="right"]')!;
    const titles = within(rightSlot as HTMLElement)
      .getAllByRole("button", { name: /^Box (B|C)$/ })
      .map((btn) => btn.textContent);
    expect(titles[0]).toContain("B");
    expect(titles[1]).toContain("C");
  });

  it("shows an empty-slot placeholder when a slot has no children", () => {
    resetFixtureIds();
    const document = fixtureDocument([fixtureNode(FIXTURE_IDS.split, {}, { left: [], right: [] }, "split")]);
    render(<ComposerTree document={document} {...baseProps()} expandedIds={new Set(["split"])} />);
    expect(screen.getAllByText("Empty slot")).toHaveLength(2);
  });

  it("keeps duplicate component types distinct via stable node ids", () => {
    resetFixtureIds();
    const document = fixtureDocument([
      fixtureNode(
        FIXTURE_IDS.stack,
        {},
        {
          content: [
            fixtureNode(FIXTURE_IDS.box, { label: "one" }, {}, "box-1"),
            fixtureNode(FIXTURE_IDS.box, { label: "two" }, {}, "box-2"),
          ],
        },
        "stack",
      ),
    ]);
    const { container } = render(
      <ComposerTree document={document} {...baseProps()} expandedIds={new Set(["stack"])} />,
    );
    const boxButtons = container.querySelectorAll(
      '[data-sg-tree-node-id="box-1"], [data-sg-tree-node-id="box-2"]',
    );
    expect(boxButtons).toHaveLength(2);
    expect(screen.getAllByText("Box")).toHaveLength(2);
  });

  it("hides children and the empty-slot text while a container is collapsed", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    render(<ComposerTree document={document} {...baseProps()} expandedIds={new Set()} />);
    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(screen.queryByText("Empty slot")).not.toBeInTheDocument();
  });

  it("toggling disclosure calls onToggleExpanded with the node id", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    render(<ComposerTree document={document} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /expand split layout/i }));
    expect(props.onToggleExpanded).toHaveBeenCalledWith("split");
  });

  it("clicking a real node's row calls onReveal, and the root row calls onSelect(null)", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    render(<ComposerTree document={document} {...props} expandedIds={new Set(["split"])} />);

    fireEvent.click(screen.getByRole("button", { name: "Document root" }));
    expect(props.onSelect).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: "Split Layout" }));
    expect(props.onReveal).toHaveBeenCalledWith("split");
  });

  it("does not use role=tree (plain nested lists/buttons per the issue's constraint)", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const { container } = render(
      <ComposerTree document={document} {...baseProps()} expandedIds={new Set(["split"])} />,
    );
    expect(container.querySelector('[role="tree"]')).toBeNull();
    expect(container.querySelectorAll("ul").length).toBeGreaterThan(0);
  });
});

describe("ComposerTree — opaque/unavailable placeholders", () => {
  it("renders an unknown component as an 'Unavailable' placeholder that stays selectable", () => {
    resetFixtureIds();
    const document = fixtureDocument([fixtureNode("unknown.widget", {}, {}, "mystery")]);
    const props = baseProps();
    render(<ComposerTree document={document} {...props} />);
    expect(screen.getByText("unknown.widget")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "unknown.widget Unavailable" }));
    expect(props.onReveal).toHaveBeenCalledWith("mystery");
  });

  it("does not offer Add under an opaque node's slots", () => {
    resetFixtureIds();
    // A known component at the wrong version is opaque, but its declared slots
    // are still rendered (read-only) — Add must not appear.
    const document = fixtureDocument([
      { id: "split", componentId: FIXTURE_IDS.split, componentVersion: 99, props: {}, slots: { left: [], right: [] } },
    ]);
    render(<ComposerTree document={document} {...baseProps()} expandedIds={new Set(["split"])} />);
    expect(screen.queryByRole("button", { name: /Add component to Left/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add component to Right/i })).not.toBeInTheDocument();
  });
});

describe("ComposerTree — component chooser target capture", () => {
  it("opens the chooser with a slot target (index = end) when a slot's Add is clicked", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    render(<ComposerTree document={document} {...props} expandedIds={new Set(["split"])} />);
    fireEvent.click(screen.getByRole("button", { name: /Add component to Right in Split Layout/i }));
    expect(props.onOpenChooser).toHaveBeenCalledWith({ parentId: "split", slotId: "right", index: 2 });
  });

  it("hides Add for a single-cardinality slot that is already occupied", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    render(<ComposerTree document={document} {...baseProps()} expandedIds={new Set(["split"])} />);
    expect(screen.queryByRole("button", { name: /Add component to Left in Split Layout/i })).not.toBeInTheDocument();
  });

  it("root Add opens the chooser targeting the virtual root", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    render(<ComposerTree document={document} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add component to document root" }));
    expect(props.onOpenChooser).toHaveBeenCalledWith({ parentId: null, slotId: "root", index: 1 });
  });
});

describe("ComposerTree — structural actions", () => {
  it("disables move-up on the first sibling and move-down on the last sibling", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    render(<ComposerTree document={document} {...baseProps()} expandedIds={new Set(["split"])} />);
    expect(screen.getByRole("button", { name: "Move Box B up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Box B down" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Box C down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Box C up" })).not.toBeDisabled();
  });

  it("reorder buttons call onReorder with the node id and direction", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    render(<ComposerTree document={document} {...props} expandedIds={new Set(["split"])} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Box C up" }));
    expect(props.onReorder).toHaveBeenCalledWith("C", "up");
  });

  it("removes a leaf immediately with no confirmation step", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    render(<ComposerTree document={document} {...props} expandedIds={new Set(["split"])} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Box B" }));
    expect(props.onRemove).toHaveBeenCalledWith("B");
  });

  it("requires explicit confirmation before removing a populated container, and cancel makes no removal", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    render(<ComposerTree document={document} {...props} expandedIds={new Set(["split"])} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Split Layout" }));
    expect(props.onRemove).not.toHaveBeenCalled();
    expect(screen.getByText(/Remove Split Layout and its 3 nested components\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onRemove).not.toHaveBeenCalled();
    expect(screen.queryByText(/nested components\?/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Split Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(props.onRemove).toHaveBeenCalledWith("split");
  });

  it("opaque nodes remain movable and removable", () => {
    resetFixtureIds();
    const document = fixtureDocument([
      fixtureNode(FIXTURE_IDS.box, {}, {}, "known"),
      fixtureNode("unknown.widget", {}, {}, "mystery"),
    ]);
    const props = baseProps();
    render(<ComposerTree document={document} {...props} />);
    expect(screen.getByRole("button", { name: "Move unknown.widget up" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove unknown.widget" }));
    expect(props.onRemove).toHaveBeenCalledWith("mystery");
  });

  it("hides all mutating affordances in readOnly mode", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    render(<ComposerTree document={document} {...baseProps()} expandedIds={new Set(["split"])} readOnly />);
    expect(screen.queryByRole("button", { name: /Add component/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Move /i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove /i })).not.toBeInTheDocument();
  });
});

describe("ComposerTree — focus retention across rerenders", () => {
  it("keeps focus on a row's select button after a rerender triggered by a prop change", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const props = baseProps();
    const { rerender } = render(
      <ComposerTree document={document} {...props} expandedIds={new Set(["split"])} />,
    );
    const bButton = screen.getByRole("button", { name: "Box B" });
    bButton.focus();
    expect(bButton).toHaveFocus();

    rerender(<ComposerTree document={document} {...props} selectedId="B" expandedIds={new Set(["split"])} />);
    expect(screen.getByRole("button", { name: "Box B" })).toHaveFocus();
  });
});

describe("ComposerTree — expansion/reveal", () => {
  it("scrolls the selected row into view when selectedId changes to a now-rendered node", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const scrollSpy = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollSpy;
    const props = baseProps();
    const { rerender } = render(
      <ComposerTree document={document} {...props} selectedId={null} expandedIds={new Set()} />,
    );
    expect(scrollSpy).not.toHaveBeenCalled();

    rerender(<ComposerTree document={document} {...props} selectedId="B" expandedIds={new Set(["split"])} />);
    expect(scrollSpy).toHaveBeenCalled();
  });
});
