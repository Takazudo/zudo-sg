/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { VIRTUAL_ROOT_SLOT_ID } from "@/composer";
import type { InsertionTarget } from "@/composer";
import { ComposerChooser } from "../composer-chooser";
import { FIXTURE_IDS, fixtureCatalog, makeAbcDocument, resetFixtureIds } from "../../tree/__tests__/fixtures";

const rightTarget: InsertionTarget = { parentId: "split", slotId: "right", index: 2 };
const rootTarget: InsertionTarget = { parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 1 };

function baseProps(overrides: Partial<Parameters<typeof ComposerChooser>[0]> = {}) {
  resetFixtureIds();
  return {
    open: true,
    target: rightTarget,
    document: makeAbcDocument(),
    manifest: fixtureCatalog,
    onAdd: vi.fn(),
    onExpandAncestors: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("ComposerChooser — modal behavior", () => {
  it("shows as an open, labelled dialog with an accessible title", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(screen.getByRole("heading", { name: "Add a component" })).toBeInTheDocument();
  });

  it("focuses the search input on open", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    expect(screen.getByPlaceholderText("Search components…")).toHaveFocus();
  });

  it("Escape closes without adding anything, and fires onClose", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    fireEvent.keyDown(screen.getByRole("dialog", { hidden: true }), { key: "Escape" });
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes without adding anything", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the trigger element after closing", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Add";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const props = baseProps();
    render(<ComposerChooser {...props} />);
    expect(trigger).not.toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("wraps Tab from the last focusable element back to the first, and Shift+Tab from first to last", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const focusable = dialog.querySelectorAll("button, input");
    const lastFocusable = focusable[focusable.length - 1] as HTMLElement;

    lastFocusable.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(lastFocusable).toHaveFocus();
  });
});

describe("ComposerChooser — target capture survives a selection change", () => {
  it("keeps adding to the target captured at open time even after the target prop changes while open", () => {
    resetFixtureIds();
    const onAdd = vi.fn();
    const document = makeAbcDocument();

    function Harness() {
      const [target, setTarget] = useState<InsertionTarget>(rightTarget);
      return (
        <>
          <button type="button" onClick={() => setTarget(rootTarget)}>
            Simulate selection change
          </button>
          <ComposerChooser
            open
            target={target}
            document={document}
            manifest={fixtureCatalog}
            onAdd={onAdd}
            onExpandAncestors={vi.fn()}
            onClose={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByText("Split Layout › Right")).toBeInTheDocument();

    // Simulate a selection change elsewhere in the app redirecting the live
    // `target` prop WHILE the dialog is still open.
    fireEvent.click(screen.getByRole("button", { name: "Simulate selection change" }));
    expect(screen.getByText("Split Layout › Right")).toBeInTheDocument();
    expect(screen.queryByText("Document root")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Box/ }));
    expect(onAdd).toHaveBeenCalledWith(rightTarget, FIXTURE_IDS.box);
    expect(onAdd).not.toHaveBeenCalledWith(rootTarget, expect.anything());
  });
});

describe("ComposerChooser — search / category / constraint filters", () => {
  it("shows the destination label and every eligible component with a result count", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    expect(screen.getByText("Split Layout › Right")).toBeInTheDocument();
    expect(screen.getByText(/\d+ of \d+ components?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Box/ })).toBeInTheDocument();
  });

  it("filters the accepts-restricted gallery slot down to Box only", () => {
    const document = makeAbcDocument();
    document.root.push({
      id: "gallery",
      componentId: FIXTURE_IDS.gallery,
      componentVersion: 1,
      props: {},
      slots: { items: [] },
    });
    const props = baseProps({ document, target: { parentId: "gallery", slotId: "items", index: 0 } });
    render(<ComposerChooser {...props} />);
    expect(screen.getByRole("button", { name: /^Box/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Stack/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Button/ })).not.toBeInTheDocument();
  });

  it("blocks a chooser opened on an already-occupied single-cardinality slot", () => {
    const props = baseProps({ target: { parentId: "split", slotId: "left", index: 1 } });
    render(<ComposerChooser {...props} />);
    expect(screen.getByText(/already has a component/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Box/ })).not.toBeInTheDocument();
  });

  it("search narrows the result list and shows an empty state with a clear-filters action for no matches", () => {
    const props = baseProps({ target: rootTarget });
    render(<ComposerChooser {...props} />);
    const search = screen.getByPlaceholderText("Search components…");

    fireEvent.input(search, { target: { value: "box" } });
    expect(screen.getByRole("button", { name: /^Box/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Button/ })).not.toBeInTheDocument();

    fireEvent.input(search, { target: { value: "zzz-no-match" } });
    expect(screen.getByText(/No matching components/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: /^Box/ })).toBeInTheDocument();
  });

  it("category filters narrow the list and are keyboard-activatable buttons", () => {
    const props = baseProps({ target: rootTarget });
    render(<ComposerChooser {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("button", { name: /^Button/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Box/ })).not.toBeInTheDocument();
  });
});

describe("ComposerChooser — Enter / Escape and successful add", () => {
  it("Enter in the search field adds the sole matching result", () => {
    const props = baseProps({ target: rootTarget });
    render(<ComposerChooser {...props} />);
    const search = screen.getByPlaceholderText("Search components…");
    fireEvent.input(search, { target: { value: "gallery" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(props.onAdd).toHaveBeenCalledWith(rootTarget, FIXTURE_IDS.gallery);
  });

  it("choosing a component adds to the captured target, expands ancestors, and closes", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /^Box/ }));
    expect(props.onAdd).toHaveBeenCalledWith(rightTarget, FIXTURE_IDS.box);
    expect(props.onExpandAncestors).toHaveBeenCalledWith(["split"]);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("announces a status message after a successful add", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /^Box/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/Box added to Split Layout › Right/);
  });
});
