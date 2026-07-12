/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import { fireEvent, render, screen } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { VIRTUAL_ROOT_SLOT_ID } from "@/composer";
import type { InsertionTarget } from "@/composer";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";
import type { ComposerPreviewLocation } from "@/features/composer/preview";
import { ComposerChooser } from "../composer-chooser";
import { CHOOSER_PREVIEW_PLACEHOLDER_ID } from "../chooser-preview-host";
import { FIXTURE_IDS, fixtureCatalog, makeAbcDocument, resetFixtureIds } from "../../tree/__tests__/fixtures";
import { makeChooserPreviewBridgeHarness } from "./preview-bridge-test-harness";

const rightTarget: InsertionTarget = { parentId: "split", slotId: "right", index: 2 };
const rootTarget: InsertionTarget = { parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: 1 };

// `ChooserPreviewHost` (issue #254) mounts unconditionally whenever the
// dialog has eligible content — tests that don't care about its own bridge
// still render it. Defaulting `previewLocation` to `about:blank` (like
// `app/test-support/preview-harness.ts`'s own harness) keeps happy-dom from
// attempting a real network fetch for `/composer/preview` in every one of
// #250's pre-existing tests below.
const INERT_PREVIEW_LOCATION: ComposerPreviewLocation = {
  src: "about:blank",
  targetOrigin: "https://composer-chooser-inert.test",
};

// The shared tree/chooser fixture catalog (issue #250) is intentionally
// generic and carries no `ui.placeholder-box`-shaped entry — this issue's
// preview pane needs one, so it's appended locally rather than editing that
// shared fixture (owned by `ui/tree/**`, outside this issue's scope).
const placeholderFixtureEntry: ComposerManifestEntry = {
  componentId: CHOOSER_PREVIEW_PLACEHOLDER_ID,
  version: 1,
  title: "Placeholder Box",
  category: "Media",
  description: "Labeled image stand-in.",
  source: { module: "@fixtures/placeholder-box", exportKind: "named", exportName: "PlaceholderBox" },
  defaults: { label: "hero-image.png" },
  fields: [],
  slots: [],
};
const catalogWithPlaceholder: ComposerManifestEntry[] = [...fixtureCatalog, placeholderFixtureEntry];

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
    previewLocation: INERT_PREVIEW_LOCATION,
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
    const focusable = dialog.querySelectorAll("button, input");
    const firstFocusable = focusable[0] as HTMLElement;
    const lastFocusable = focusable[focusable.length - 1] as HTMLElement;

    lastFocusable.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(firstFocusable).toHaveFocus();

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
            previewLocation={INERT_PREVIEW_LOCATION}
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

describe("ComposerChooser — live preview pane (issue #254)", () => {
  it("shows an empty-state hint before the first hover/focus", () => {
    const harness = makeChooserPreviewBridgeHarness();
    const props = baseProps({ previewCreateBridge: harness.createBridge, previewLocation: harness.location });
    render(<ComposerChooser {...props} />);
    expect(screen.getByText(/Hover or focus a component to preview it here/)).toBeInTheDocument();
    act(() => harness.deliverReady());
    expect(harness.posts).toHaveLength(0);
  });

  it("hovering a catalog card renders it (defaults) in the SECOND, dedicated preview iframe", () => {
    const harness = makeChooserPreviewBridgeHarness();
    const props = baseProps({ previewCreateBridge: harness.createBridge, previewLocation: harness.location });
    render(<ComposerChooser {...props} />);
    act(() => harness.deliverReady());

    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Box/ }));
    expect(harness.posts).toHaveLength(1);
    const message = harness.posts[0]!.message as {
      type: string;
      document: { root: { componentId: string }[] };
      session: { mode: string };
    };
    expect(message.type).toBe("render");
    expect(message.document.root[0]!.componentId).toBe(FIXTURE_IDS.box);
    // Non-interactive: the preview never enters "edit" session mode.
    expect(message.session.mode).toBe("preview");
    expect(screen.queryByText(/Hover or focus a component/)).not.toBeInTheDocument();
  });

  it("keyboard-focusing a catalog card ALSO updates the preview target", () => {
    const harness = makeChooserPreviewBridgeHarness();
    const props = baseProps({
      target: rootTarget,
      previewCreateBridge: harness.createBridge,
      previewLocation: harness.location,
    });
    render(<ComposerChooser {...props} />);
    act(() => harness.deliverReady());

    fireEvent.focus(screen.getByRole("button", { name: /^Text/ }));
    expect(harness.posts).toHaveLength(1);
    const message = harness.posts[0]!.message as { document: { root: { componentId: string }[] } };
    expect(message.document.root[0]!.componentId).toBe(FIXTURE_IDS.text);
  });

  it("is sticky: the previewed entry survives mouseleave, and is only replaced by the NEXT hover/focus", () => {
    const harness = makeChooserPreviewBridgeHarness();
    const props = baseProps({
      target: rootTarget,
      previewCreateBridge: harness.createBridge,
      previewLocation: harness.location,
    });
    render(<ComposerChooser {...props} />);
    act(() => harness.deliverReady());

    const boxCard = screen.getByRole("button", { name: /^Box/ });
    fireEvent.mouseEnter(boxCard);
    expect(harness.posts).toHaveLength(1);

    fireEvent.mouseLeave(boxCard);
    expect(harness.posts).toHaveLength(1); // no clear-on-leave

    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Button/ }));
    expect(harness.posts).toHaveLength(2);
    const latest = harness.posts.at(-1)!.message as { document: { root: { componentId: string }[] } };
    expect(latest.document.root[0]!.componentId).toBe(FIXTURE_IDS.button);
  });

  it("a hovered CONTAINER entry's preview includes a PlaceholderBox child in every declared slot", () => {
    const harness = makeChooserPreviewBridgeHarness();
    const props = baseProps({
      target: rootTarget,
      manifest: catalogWithPlaceholder,
      previewCreateBridge: harness.createBridge,
      previewLocation: harness.location,
    });
    render(<ComposerChooser {...props} />);
    act(() => harness.deliverReady());

    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Split Layout/ }));
    expect(harness.posts).toHaveLength(1);
    const message = harness.posts[0]!.message as {
      document: { root: { componentId: string; slots: Record<string, { componentId: string }[]> }[] };
    };
    const root = message.document.root[0]!;
    expect(root.componentId).toBe(FIXTURE_IDS.split);
    expect(root.slots.left).toHaveLength(1);
    expect(root.slots.left![0]!.componentId).toBe(CHOOSER_PREVIEW_PLACEHOLDER_ID);
    expect(root.slots.right).toHaveLength(1);
    expect(root.slots.right![0]!.componentId).toBe(CHOOSER_PREVIEW_PLACEHOLDER_ID);
  });

  it("a leaf entry's preview carries no slot children", () => {
    const harness = makeChooserPreviewBridgeHarness();
    const props = baseProps({ previewCreateBridge: harness.createBridge, previewLocation: harness.location });
    render(<ComposerChooser {...props} />);
    act(() => harness.deliverReady());

    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Box/ }));
    const message = harness.posts[0]!.message as { document: { root: { slots: Record<string, unknown> }[] } };
    expect(message.document.root[0]!.slots).toEqual({});
  });
});

describe("ComposerChooser — enlarge toggle (issue #254)", () => {
  it("toggles the dialog's enlarged geometry attribute and aria-pressed", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    const enlargeButton = screen.getByRole("button", { name: "Enlarge chooser" });
    expect(enlargeButton).toHaveAttribute("aria-pressed", "false");
    expect(dialog).toHaveAttribute("data-sg-enlarged", "false");

    fireEvent.click(enlargeButton);
    expect(dialog).toHaveAttribute("data-sg-enlarged", "true");
    expect(screen.getByRole("button", { name: "Restore chooser to default size" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore chooser to default size" }));
    expect(dialog).toHaveAttribute("data-sg-enlarged", "false");
  });

  it("resets to the default size on every fresh open", () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            close
          </button>
          <button type="button" onClick={() => setOpen(true)}>
            open
          </button>
          <ComposerChooser
            open={open}
            target={rootTarget}
            document={makeAbcDocument()}
            manifest={fixtureCatalog}
            onAdd={vi.fn()}
            onExpandAncestors={vi.fn()}
            onClose={() => setOpen(false)}
            previewLocation={INERT_PREVIEW_LOCATION}
          />
        </>
      );
    }
    resetFixtureIds();
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge chooser" }));
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("data-sg-enlarged", "true");

    fireEvent.click(screen.getByText("close"));
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("data-sg-enlarged", "false");
    expect(screen.getByRole("button", { name: "Enlarge chooser" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not disturb #250's Tab-wrap focus containment while enlarged", () => {
    const props = baseProps();
    render(<ComposerChooser {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge chooser" }));

    const dialog = screen.getByRole("dialog", { hidden: true });
    const focusable = dialog.querySelectorAll("button, input");
    const firstFocusable = focusable[0] as HTMLElement;
    const lastFocusable = focusable[focusable.length - 1] as HTMLElement;

    lastFocusable.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(firstFocusable).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(lastFocusable).toHaveFocus();
  });

  it("Escape still closes (and restores focus) while enlarged", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Add";
    document.body.appendChild(trigger);
    trigger.focus();

    const props = baseProps();
    render(<ComposerChooser {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge chooser" }));
    fireEvent.keyDown(screen.getByRole("dialog", { hidden: true }), { key: "Escape" });
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
