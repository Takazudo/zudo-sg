// Renderer behaviour against the REAL #246 cohort and the REAL trusted registry
// — no stub components, so slot projection is proved against production
// `Stack` / `SplitLayout`, not against a lookalike.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "preact";
import { act } from "preact/test-utils";
import { fireEvent, render } from "@testing-library/preact";
import type { CompositionDocument, CompositionNode } from "@/composer";
import { COMPOSITION_SCHEMA_VERSION } from "@/composer";
import { composerEntries } from "@/styleguide/data/composer-registry";
import { CompositionCanvas, focusByToken, type CompositionCanvasProps } from "../renderer";
import type { PreviewSession } from "../protocol";

const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };
const PREVIEW: PreviewSession = { mode: "preview", theme: "light", selectedId: null };

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

function draw(document: CompositionDocument, overrides: Partial<CompositionCanvasProps> = {}) {
  const props: CompositionCanvasProps = {
    document,
    entries: composerEntries,
    session: EDIT,
    onSelect: vi.fn(),
    onRequestAdd: vi.fn(),
    onRequestNodeMenu: vi.fn(),
    onRequestInsertMenu: vi.fn(),
    ...overrides,
  };
  return { ...render(h(CompositionCanvas, props)), props };
}

/** The insert points a slot exposes, as `parent:slot:index` strings, in order. */
function insertTargets(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-zc-insert]")].map(
    (el) => el.getAttribute("data-zc-insert") ?? "",
  );
}

// ── The fixture: the shape the epic's fixed walkthrough demands ──────────────
// SplitLayout(left: SectionHeading) + (right: [Stack(prose, prose), CtaButton]).
const SPLIT = doc([
  node(
    "split-1",
    "ui.split-layout",
    { ratio: "50/50", gap: "lg" },
    {
      left: [node("heading-1", "ui.section-heading", { heading: "Compose", as: "h2" })],
      right: [
        node(
          "stack-1",
          "ui.stack",
          { gap: "md" },
          {
            content: [
              node("prose-1", "ui.prose-p", { children: "First paragraph." }),
              node("prose-2", "ui.prose-p", { children: "Second paragraph." }),
            ],
          },
        ),
        node("cta-1", "ui.cta-button", { href: "/get-started", children: "Get started" }),
      ],
    },
  ),
]);

describe("slot projection", () => {
  it("projects a DEFAULT slot (Stack `content` → the `children` prop), in order", () => {
    const { container } = draw(SPLIT, { session: PREVIEW });
    const stack = container.querySelector('[data-zc-node-id="stack-1"] > div')!;
    // The real production Stack: a flex column.
    expect(stack.className).toContain("flex");
    expect(stack.className).toContain("flex-col");

    const paragraphs = [...stack.querySelectorAll("p")].map((p) => p.textContent);
    expect(paragraphs).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("projects NAMED slots onto their real props (SplitLayout left/right)", () => {
    const { container } = draw(SPLIT, { session: PREVIEW });
    const split = container.querySelector('[data-zc-node-id="split-1"] > div')!;
    expect(split.className).toContain("md:flex-row");

    const [leftPane, rightPane] = [...split.children] as HTMLElement[];
    // `left` is `single` → the heading, and only the heading.
    expect(leftPane!.querySelector('[data-zc-node-id="heading-1"]')).not.toBeNull();
    expect(leftPane!.querySelector('[data-zc-node-id="stack-1"]')).toBeNull();
    // `right` is `many` → BOTH children, in document order.
    const rightIds = [...rightPane!.querySelectorAll("[data-zc-node-id]")].map((el) =>
      el.getAttribute("data-zc-node-id"),
    );
    expect(rightIds.slice(0, 1)).toEqual(["stack-1"]);
    expect(rightIds).toContain("cta-1");
    expect(rightIds.indexOf("stack-1")).toBeLessThan(rightIds.indexOf("cta-1"));
  });

  it("a `single` slot receives the child itself, not a one-element array", () => {
    // If it were wrapped, SplitLayout's `left` pane would still render, so the
    // real proof is that exactly one node wrapper lands in the left pane.
    const { container } = draw(SPLIT, { session: PREVIEW });
    const leftPane = container.querySelector('[data-zc-node-id="split-1"] > div > div')!;
    expect(leftPane.querySelectorAll("[data-zc-node-id]")).toHaveLength(1);
  });

  it("renders defaults under the document's own props", () => {
    // ui.card's defaults give it a title; the document overrides it.
    const document = doc([node("card-1", "ui.card", { title: "Overridden" }, { body: [] })]);
    const { container } = draw(document, { session: PREVIEW });
    expect(container.textContent).toContain("Overridden");
    expect(container.textContent).not.toContain("Card heading");
  });
});

describe("insert points — one at EVERY addable index of EVERY declared slot", () => {
  it("emits before the first child, between siblings, and at the end", () => {
    const { container } = draw(SPLIT);
    const targets = insertTargets(container);

    // Virtual root (1 child) → indices 0,1.
    expect(targets).toContain(":root:0");
    expect(targets).toContain(":root:1");
    // SplitLayout `right` (2 children) → indices 0,1,2.
    expect(targets).toContain("split-1:right:0");
    expect(targets).toContain("split-1:right:1");
    expect(targets).toContain("split-1:right:2");
    // Stack `content` (2 children) → indices 0,1,2.
    expect(targets).toContain("stack-1:content:0");
    expect(targets).toContain("stack-1:content:1");
    expect(targets).toContain("stack-1:content:2");
  });

  it("gives a FULL `single` slot no insert point (there is no addable index)", () => {
    const { container } = draw(SPLIT);
    expect(insertTargets(container).filter((t) => t.startsWith("split-1:left:"))).toEqual([]);
  });

  it("gives an EMPTY slot exactly one insert point, doubling as its placeholder", () => {
    const document = doc([node("stack-1", "ui.stack", {}, { content: [] })]);
    const { container } = draw(document);
    expect(insertTargets(container)).toContain("stack-1:content:0");
    const empty = container.querySelector('[data-zc-insert="stack-1:content:0"]')!;
    expect(empty.className).toContain("zc-insert--empty");
  });

  it("emits #245's InsertionTarget — an insert-at-INDEX, not an append-only slot ref", () => {
    const onRequestAdd = vi.fn();
    const { container } = draw(SPLIT, { onRequestAdd });

    fireEvent.click(container.querySelector('[data-zc-insert="stack-1:content:1"]')!);
    expect(onRequestAdd).toHaveBeenCalledWith({
      parentId: "stack-1",
      slotId: "content",
      index: 1,
    });

    fireEvent.click(container.querySelector('[data-zc-insert=":root:0"]')!);
    expect(onRequestAdd).toHaveBeenLastCalledWith({ parentId: null, slotId: "root", index: 0 });
  });

  it("is absent entirely in Preview mode", () => {
    const { container } = draw(SPLIT, { session: PREVIEW });
    expect(insertTargets(container)).toEqual([]);
  });

  it("uses the vertical-BAR variant for a horizontal-flow container's BETWEEN point (the END point gets the #283 compact button instead)", () => {
    const document = doc([
      node(
        "row-1",
        "ui.stack",
        { direction: "horizontal" },
        { content: [node("p-1", "ui.prose-p", { children: "a" })] },
      ),
    ]);
    const { container } = draw(document);
    const points = [...container.querySelectorAll('[data-zc-insert^="row-1:content:"]')];
    expect(points).toHaveLength(2);

    // index 0: before the only child — the slim between-bar, unchanged.
    const between = container.querySelector('[data-zc-insert="row-1:content:0"]')!;
    expect(between.className).toContain("zc-insert--horizontal");

    // index 1 (== children.length): the slot's END point — the enlarged
    // compact/auto-width button (issue #283), not the bar variant.
    const end = container.querySelector('[data-zc-insert="row-1:content:1"]')!;
    expect(end.className).not.toContain("zc-insert--horizontal");
    expect(end.className).toContain("zc-insert-end-btn");
    expect(end.closest(".zc-insert-group")!.className).toContain("zc-insert-end--horizontal");
  });

  it("uses the horizontal-RULE variant for a vertical-flow container", () => {
    const { container } = draw(SPLIT);
    const point = container.querySelector('[data-zc-insert="stack-1:content:0"]')!;
    expect(point.className).toContain("zc-insert--vertical");
  });

  it("treats a grid container (ui.auto-grid) as horizontal flow", () => {
    const document = doc([
      node("grid-1", "ui.auto-grid", {}, { items: [node("c-1", "ui.card", {}, { body: [] })] }),
    ]);
    const { container } = draw(document);
    const point = container.querySelector('[data-zc-insert="grid-1:items:0"]')!;
    expect(point.className).toContain("zc-insert--horizontal");
  });
});

describe("A7: end-of-slot add affordance + icon glyphs (issue #283)", () => {
  it("renders the slot's END point as the enlarged labeled button, with the dots companion", () => {
    const { container } = draw(SPLIT);
    // stack-1's `content` slot holds 2 children → index 2 is the END point.
    const endButton = container.querySelector('[data-zc-insert="stack-1:content:2"]')!;
    expect(endButton.className).toContain("zc-insert-end-btn");
    expect(endButton.className).toContain("zc-insert"); // keeps the shared toning base class
    expect(endButton.textContent).toContain("Add component");
    // The "+" glyph is now a real icon (SVG), not literal text.
    expect(endButton.querySelector("svg")).not.toBeNull();

    const group = endButton.closest(".zc-insert-group")!;
    const dots = group.querySelector(".zc-insert-menu--end");
    expect(dots).not.toBeNull();
    expect(dots!.querySelector("svg")).not.toBeNull();
  });

  it("keeps the between-children bar slim and unlabeled — only the slot's END point is enlarged", () => {
    const { container } = draw(SPLIT);
    const between = container.querySelector('[data-zc-insert="stack-1:content:0"]')!;
    expect(between.className).not.toContain("zc-insert-end-btn");
    expect(between.textContent ?? "").not.toContain("Add component");
    // The between-bar's own "⋯" companion stays the plain (non-overlapping) variant.
    const group = between.closest(".zc-insert-group")!;
    expect(group.querySelector(".zc-insert-menu--end")).toBeNull();
  });

  it("keeps an empty slot's sole insert point BOTH end-styled and empty-styled (empty always implies end)", () => {
    const document = doc([node("stack-1", "ui.stack", {}, { content: [] })]);
    const { container } = draw(document);
    const button = container.querySelector('[data-zc-insert="stack-1:content:0"]')!;
    expect(button.className).toContain("zc-insert-end-btn");
    expect(button.className).toContain("zc-insert--empty");
    expect(button.textContent).toContain("Add component");
  });

  it("is full-width in column flow and compact/auto-width in row flow", () => {
    const { container } = draw(SPLIT);
    // stack-1's content flows vertically (column) → its END group is the
    // full-width variant.
    const verticalEnd = container.querySelector('[data-zc-insert="stack-1:content:2"]')!;
    const verticalGroup = verticalEnd.closest(".zc-insert-group")!;
    expect(verticalGroup.className).toContain("zc-insert-end--vertical");
    expect(verticalGroup.className).not.toContain("zc-insert-end--horizontal");
  });

  it("swaps the insert-menu ⋯ glyph and the selected-node chrome ⋯ glyph to real icons", () => {
    const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" } });
    const chromeMenu = container.querySelector(".zc-chrome-menu")!;
    expect(chromeMenu.querySelector("svg")).not.toBeNull();
    expect(chromeMenu.textContent?.trim()).toBe("");

    const insertMenu = container.querySelector(".zc-insert-menu")!;
    expect(insertMenu.querySelector("svg")).not.toBeNull();
    expect(insertMenu.textContent?.trim()).toBe("");
  });

  it("preserves the data-zc-affordance / data-zc-insert wiring and the onRequestAdd relay at the END point", () => {
    const onRequestAdd = vi.fn();
    const { container } = draw(SPLIT, { onRequestAdd });
    const endButton = container.querySelector('[data-zc-insert="stack-1:content:2"]')!;
    expect(endButton.hasAttribute("data-zc-affordance")).toBe(true);

    fireEvent.click(endButton);
    expect(onRequestAdd).toHaveBeenCalledWith({ parentId: "stack-1", slotId: "content", index: 2 });
  });
});

describe("opaque nodes", () => {
  const UNKNOWN = doc([
    node("ghost-1", "ui.does-not-exist", { title: "keep me", count: 3 }, { body: [] }),
  ]);

  it("renders a placeholder with diagnostics instead of dropping the node", () => {
    const { container } = draw(UNKNOWN);
    const wrapper = container.querySelector('[data-zc-node-id="ghost-1"]')!;
    expect(wrapper.hasAttribute("data-zc-opaque")).toBe(true);
    expect(wrapper.textContent).toContain("Unavailable component");
    expect(wrapper.textContent).toContain("ui.does-not-exist");
    expect(wrapper.querySelector(".zc-opaque-reasons")!.textContent).toContain("Unknown component");
  });

  it("preserves the whole payload verbatim", () => {
    const { container } = draw(UNKNOWN);
    const payload = container.querySelector(".zc-opaque-payload pre")!.textContent ?? "";
    expect(JSON.parse(payload)).toEqual(UNKNOWN.root[0]);
  });

  it("stays SELECTABLE", () => {
    const onSelect = vi.fn();
    const { container } = draw(UNKNOWN, { onSelect });
    fireEvent.click(container.querySelector(".zc-opaque-title")!);
    expect(onSelect).toHaveBeenCalledWith("ghost-1");
  });

  it("marks an unsupported component VERSION opaque too", () => {
    const stale: CompositionDocument = doc([
      { ...node("prose-1", "ui.prose-p", { children: "x" }), componentVersion: 0 },
    ]);
    const { container } = draw(stale);
    const wrapper = container.querySelector('[data-zc-node-id="prose-1"]')!;
    expect(wrapper.hasAttribute("data-zc-opaque")).toBe(true);
    expect(wrapper.textContent).toContain("v0");
  });
});

describe("Edit vs Preview action behaviour", () => {
  /**
   * Dispatch a real click on the rendered CtaButton's `<a>`, with a listener
   * attached to the anchor itself. `reached` is the honest test of "did this
   * control ACTIVATE": in Edit the event must never get there at all; in Preview
   * it must.
   */
  function clickAnchor(container: HTMLElement): {
    event: MouseEvent;
    anchor: HTMLAnchorElement;
    reached: boolean;
  } {
    const anchor = container.querySelector('[data-zc-node-id="cta-1"] a') as HTMLAnchorElement;
    let reached = false;
    anchor.addEventListener("click", () => {
      reached = true;
    });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    return { event, anchor, reached };
  }

  it("EDIT: a rendered link does NOT activate — the click selects its node instead", () => {
    const onSelect = vi.fn();
    const { container } = draw(SPLIT, { onSelect });
    const { event, anchor, reached } = clickAnchor(container);

    expect(anchor.getAttribute("href")).toBe("/get-started");
    // Swallowed in the capture phase: it never reaches the anchor's own handlers,
    // and its default (navigation) is cancelled.
    expect(reached).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledWith("cta-1");
  });

  it("EDIT: keyboard activation of a rendered link is swallowed too", () => {
    const { container } = draw(SPLIT);
    const anchor = container.querySelector('[data-zc-node-id="cta-1"] a')!;
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("EDIT: editor affordances still work — a click on an insert point is not swallowed", () => {
    const onRequestAdd = vi.fn();
    const onSelect = vi.fn();
    const { container } = draw(SPLIT, { onRequestAdd, onSelect });
    fireEvent.click(container.querySelector('[data-zc-insert=":root:0"]')!);
    expect(onRequestAdd).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("EDIT: clicking the empty canvas deselects", () => {
    const onSelect = vi.fn();
    const { container } = draw(doc([]), { onSelect });
    fireEvent.click(container.querySelector(".zc-canvas")!);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("PREVIEW: the SAME link activates normally and selection is not emitted", () => {
    const onSelect = vi.fn();
    const { container } = draw(SPLIT, { session: PREVIEW, onSelect });
    const { event, reached } = clickAnchor(container);

    // The click REACHES the control — ordinary interaction works on the same
    // component DOM, and no editor selection is emitted.
    expect(reached).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    // …but the link's default is still suppressed: navigating THIS document away
    // would unload the live preview runtime the Composer is driving, and nothing
    // could bring it back — "return to Edit with state intact" would silently
    // stop being true.
    expect(event.defaultPrevented).toBe(true);
  });

  it("PREVIEW: a plain in-page anchor is left completely alone", () => {
    const document = doc([node("cta-1", "ui.cta-button", { href: "#section", children: "Jump" })]);
    const { container } = draw(document, { session: PREVIEW });
    const anchor = container.querySelector("a")!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("PREVIEW: every editor decoration is gone from the DOM", () => {
    const { container } = draw(SPLIT, { session: PREVIEW });
    expect(container.querySelectorAll(".zc-chrome")).toHaveLength(0);
    expect(container.querySelectorAll("[data-zc-insert]")).toHaveLength(0);
  });

  it("EDIT: selection is expressed as an attribute, and chrome is present", () => {
    const { container } = draw(SPLIT, {
      session: { ...EDIT, selectedId: "prose-1" },
    });
    const selected = container.querySelector("[data-zc-selected]")!;
    expect(selected.getAttribute("data-zc-node-id")).toBe("prose-1");
    expect(container.querySelectorAll(".zc-chrome").length).toBeGreaterThan(0);
  });
});

describe("DOM identity stability (hard acceptance criterion)", () => {
  it("toggling SELECTION never remounts the component's DOM node", () => {
    const { container, rerender, props } = draw(SPLIT);
    const before = container.querySelector('[data-zc-node-id="prose-1"] > p')!;
    const wrapperBefore = container.querySelector('[data-zc-node-id="prose-1"]')!;

    rerender(
      h(CompositionCanvas, { ...props, session: { ...EDIT, selectedId: "prose-1" } }),
    );
    const after = container.querySelector('[data-zc-node-id="prose-1"] > p')!;
    expect(after).toBe(before);
    expect(container.querySelector('[data-zc-node-id="prose-1"]')).toBe(wrapperBefore);
    expect(wrapperBefore.hasAttribute("data-zc-selected")).toBe(true);

    rerender(h(CompositionCanvas, { ...props, session: { ...EDIT, selectedId: null } }));
    expect(container.querySelector('[data-zc-node-id="prose-1"] > p')).toBe(before);
    expect(wrapperBefore.hasAttribute("data-zc-selected")).toBe(false);
  });

  it("HOVER is pure CSS — it triggers no re-render, so it cannot remount anything", () => {
    const { container } = draw(SPLIT);
    const before = container.querySelector('[data-zc-node-id="cta-1"] a')!;
    fireEvent.mouseOver(before);
    fireEvent.mouseEnter(before);
    expect(container.querySelector('[data-zc-node-id="cta-1"] a')).toBe(before);
  });

  it("toggling EDIT ⇄ PREVIEW keeps the SAME component DOM node", () => {
    // The chrome `<span>` sits next to the component's own output. Preact's
    // UNKEYED children diff can cross-match those two and destroy the component's
    // node; both are keyed, so removing the chrome touches only the chrome.
    const { container, rerender, props } = draw(SPLIT);
    const paragraph = container.querySelector('[data-zc-node-id="prose-1"] > p')!;
    const anchor = container.querySelector('[data-zc-node-id="cta-1"] a')!;
    expect(container.querySelectorAll(".zc-chrome").length).toBeGreaterThan(0);

    rerender(h(CompositionCanvas, { ...props, session: PREVIEW }));
    expect(container.querySelectorAll(".zc-chrome")).toHaveLength(0);
    expect(container.querySelector('[data-zc-node-id="prose-1"] > p')).toBe(paragraph);
    expect(container.querySelector('[data-zc-node-id="cta-1"] a')).toBe(anchor);

    rerender(h(CompositionCanvas, { ...props, session: EDIT }));
    expect(container.querySelector('[data-zc-node-id="prose-1"] > p')).toBe(paragraph);
    expect(container.querySelector('[data-zc-node-id="cta-1"] a')).toBe(anchor);
  });

  it("the chrome is a keyed SIBLING of the component body, not a wrapper of it", () => {
    const { container } = draw(SPLIT);
    const wrapper = container.querySelector('[data-zc-node-id="prose-1"]')!;
    const [first, second] = [...wrapper.children];
    expect(first!.className).toBe("zc-chrome");
    expect(second!.tagName).toBe("P");
  });
});

describe("menu relay (issue #256)", () => {
  it("renders the node-menu '⋯' trigger ONLY on the SELECTED node's chrome", () => {
    const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" } });
    const selectedChrome = container.querySelector('[data-zc-node-id="prose-1"] > .zc-chrome')!;
    expect(selectedChrome.querySelector(".zc-chrome-menu")).not.toBeNull();

    const otherChrome = container.querySelector('[data-zc-node-id="cta-1"] > .zc-chrome')!;
    expect(otherChrome.querySelector(".zc-chrome-menu")).toBeNull();
    // Unselected chrome stays exactly the bare, aria-hidden label.
    expect(otherChrome.getAttribute("aria-hidden")).toBe("true");
  });

  it("the node-menu trigger is not aria-hidden and carries an accessible name", () => {
    const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" } });
    const chrome = container.querySelector('[data-zc-node-id="prose-1"] > .zc-chrome')!;
    expect(chrome.hasAttribute("aria-hidden")).toBe(false);
    const trigger = chrome.querySelector(".zc-chrome-menu")!;
    expect(trigger.getAttribute("aria-label")).toMatch(/open menu/i);
  });

  it("clicking the node-menu trigger emits onRequestNodeMenu with a serialized rect + stable focus token, and does not also select", () => {
    const onRequestNodeMenu = vi.fn();
    const onSelect = vi.fn();
    const { container } = draw(SPLIT, {
      session: { ...EDIT, selectedId: "prose-1" },
      onRequestNodeMenu,
      onSelect,
    });
    fireEvent.click(container.querySelector('[data-zc-node-id="prose-1"] .zc-chrome-menu')!);

    expect(onRequestNodeMenu).toHaveBeenCalledTimes(1);
    const [nodeId, rect, focusToken] = onRequestNodeMenu.mock.calls[0]!;
    expect(nodeId).toBe("prose-1");
    expect(rect).toEqual({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
    expect(focusToken).toBe("node-menu:prose-1");
    // Swallowed before it can reach the capture-phase select handler.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("every insert point has a companion '⋯' that emits onRequestInsertMenu with the exact InsertionTarget", () => {
    const onRequestInsertMenu = vi.fn();
    const onRequestAdd = vi.fn();
    const { container } = draw(SPLIT, { onRequestInsertMenu, onRequestAdd });

    const group = container.querySelector('[data-zc-insert="stack-1:content:1"]')!.closest(".zc-insert-group")!;
    fireEvent.click(group.querySelector(".zc-insert-menu")!);

    expect(onRequestInsertMenu).toHaveBeenCalledTimes(1);
    const [target, rect, focusToken] = onRequestInsertMenu.mock.calls[0]!;
    expect(target).toEqual({ parentId: "stack-1", slotId: "content", index: 1 });
    expect(rect).toEqual({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) });
    expect(focusToken).toBe("insert-menu:stack-1:content:1");
    // The direct "+" add path is untouched by the companion trigger.
    expect(onRequestAdd).not.toHaveBeenCalled();
  });

  it("the insert-menu trigger does not disturb the direct add button's own class/attributes", () => {
    const { container } = draw(SPLIT);
    const addButton = container.querySelector('[data-zc-insert="stack-1:content:0"]')!;
    expect(addButton.className).toBe("zc-insert zc-insert--vertical");
    expect(addButton.parentElement!.className).toContain("zc-insert-group");
  });

  it("both trigger kinds are absent entirely in Preview mode", () => {
    const { container } = draw(SPLIT, { session: PREVIEW });
    expect(container.querySelectorAll(".zc-chrome-menu")).toHaveLength(0);
    expect(container.querySelectorAll(".zc-insert-menu")).toHaveLength(0);
  });

  it("focusByToken finds and focuses the exact node-menu trigger by its data-zc-focus-token", () => {
    const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" } });
    document.body.append(container);
    try {
      focusByToken("node-menu:prose-1");
      expect(document.activeElement).toBe(container.querySelector(".zc-chrome-menu"));
    } finally {
      container.remove();
    }
  });

  it("focusByToken finds and focuses the exact insert-menu trigger by its data-zc-focus-token", () => {
    const { container } = draw(SPLIT);
    document.body.append(container);
    try {
      focusByToken("insert-menu:stack-1:content:1");
      const expected = container
        .querySelector('[data-zc-insert="stack-1:content:1"]')!
        .closest(".zc-insert-group")!
        .querySelector(".zc-insert-menu");
      expect(document.activeElement).toBe(expected);
    } finally {
      container.remove();
    }
  });

  it("focusByToken is a silent no-op when nothing matches (e.g. the node was removed)", () => {
    expect(() => focusByToken("node-menu:does-not-exist")).not.toThrow();
  });
});

describe("inline text editing (issue #257)", () => {
  const EDITABLE = "[data-zc-inline-editing]";

  /** The active editable element inside a node, or null. */
  function editableOf(container: HTMLElement, nodeId: string): HTMLElement | null {
    return container.querySelector<HTMLElement>(`[data-zc-node-id="${nodeId}"] ${EDITABLE}`);
  }

  /**
   * Render (attached to the document so focus/selection work), then open an
   * inline session by clicking the already-selected node's `inner` element —
   * the click-again-on-selected entry path.
   */
  function openSession(nodeId: string, inner: string, document = SPLIT) {
    const onCommitInlineEdit = vi.fn();
    const utils = render(
      h(CompositionCanvas, {
        document,
        entries: composerEntries,
        session: { ...EDIT, selectedId: nodeId },
        onSelect: vi.fn(),
        onRequestAdd: vi.fn(),
        onRequestNodeMenu: vi.fn(),
        onRequestInsertMenu: vi.fn(),
        onCommitInlineEdit,
      }),
    );
    const target = utils.container.querySelector(`[data-zc-node-id="${nodeId}"] ${inner}`)!;
    fireEvent.click(target);
    return { ...utils, onCommitInlineEdit };
  }

  describe("entering a session", () => {
    it("opens on click-again on the SELECTED node and makes the adapter's element editable", () => {
      const { container } = openSession("prose-1", "p");
      const editable = editableOf(container, "prose-1");
      expect(editable).not.toBeNull();
      expect(editable!.tagName).toBe("P");
      expect(editable!.getAttribute("contenteditable")).toBe("true"); // prose is multiline
      expect(container.ownerDocument.activeElement).toBe(editable);
      // Content is present but was set imperatively (no vdom text child).
      expect(editable!.textContent).toBe("First paragraph.");
    });

    it("opens on DOUBLE-CLICK even when the node is not yet selected", () => {
      const onCommitInlineEdit = vi.fn();
      const { container } = render(
        h(CompositionCanvas, {
          document: SPLIT,
          entries: composerEntries,
          session: EDIT,
          onSelect: vi.fn(),
          onRequestAdd: vi.fn(),
          onRequestNodeMenu: vi.fn(),
          onRequestInsertMenu: vi.fn(),
          onCommitInlineEdit,
        }),
      );
      fireEvent.dblClick(container.querySelector('[data-zc-node-id="prose-1"] p')!);
      expect(editableOf(container, "prose-1")).not.toBeNull();
    });

    it("does NOT open on a node with no inline-editable field (just selects)", () => {
      // ui.stack has no inline-editable field.
      const onSelect = vi.fn();
      const { container } = render(
        h(CompositionCanvas, {
          document: SPLIT,
          entries: composerEntries,
          session: { ...EDIT, selectedId: "stack-1" },
          onSelect,
          onRequestAdd: vi.fn(),
          onRequestNodeMenu: vi.fn(),
          onRequestInsertMenu: vi.fn(),
          onCommitInlineEdit: vi.fn(),
        }),
      );
      fireEvent.click(container.querySelector('[data-zc-node-id="stack-1"] > div')!);
      expect(container.querySelector(EDITABLE)).toBeNull();
      expect(onSelect).toHaveBeenCalledWith("stack-1");
    });

    it("targets the RIGHT element for a decorated component (SectionHeading → h2, not the eyebrow)", () => {
      // heading-1 in SPLIT has no eyebrow; use a fixture that renders one.
      const document = doc([
        node("h-2", "ui.section-heading", { eyebrow: "About", heading: "Team", as: "h2" }),
      ]);
      const { container } = openSession("h-2", "h2", document);
      const wrapper = container.querySelector('[data-zc-node-id="h-2"]')!;
      // The h2 is the editable region…
      expect(wrapper.querySelector(`h2${EDITABLE}`)).not.toBeNull();
      // …and the eyebrow paragraph is NOT.
      const eyebrow = [...wrapper.querySelectorAll("p")].find((p) => p.textContent === "About");
      expect(eyebrow).toBeDefined();
      expect(eyebrow!.hasAttribute("data-zc-inline-editing")).toBe(false);
    });
  });

  describe("commit / cancel matrix", () => {
    it("Enter COMMITS a single-line field with the current value", () => {
      const { container, onCommitInlineEdit } = openSession("h-1", "h2", doc([
        node("h-1", "ui.section-heading", { heading: "Compose", as: "h2" }),
      ]));
      const editable = editableOf(container, "h-1")!;
      editable.textContent = "Composed";
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onCommitInlineEdit).toHaveBeenCalledTimes(1);
      expect(onCommitInlineEdit).toHaveBeenCalledWith("h-1", "heading", "Composed", 0);
      // Session exited — the editable is gone (body remounted to read mode).
      expect(container.querySelector(EDITABLE)).toBeNull();
    });

    it("blur COMMITS", () => {
      const { container, onCommitInlineEdit } = openSession("prose-1", "p");
      const editable = editableOf(container, "prose-1")!;
      editable.textContent = "Reworded body.";
      fireEvent.blur(editable);
      expect(onCommitInlineEdit).toHaveBeenCalledWith("prose-1", "children", "Reworded body.", 0);
    });

    it("does NOT commit an UNCHANGED value — a no-op commit is skipped (issue #288)", () => {
      // Regression: a blur firing the instant a session opens (before any
      // typing) used to commit the untouched seed. That no-op still advanced
      // the host's document revision, so when the dblclick re-entered a fresh
      // session and the user's REAL edit committed, it failed the session-start
      // staleness gate and was silently dropped. A no-op commit must never
      // reach the host.
      const { container, onCommitInlineEdit } = openSession("h-1", "h2", doc([
        node("h-1", "ui.section-heading", { heading: "Compose", as: "h2" }),
      ]));
      const editable = editableOf(container, "h-1")!;
      // No edit — blur with the seed value still in place.
      fireEvent.blur(editable);
      expect(onCommitInlineEdit).not.toHaveBeenCalled();
      // The session still exits cleanly (body remounted to read mode).
      expect(container.querySelector(EDITABLE)).toBeNull();
    });

    it("Escape CANCELS without committing", () => {
      const { container, onCommitInlineEdit } = openSession("prose-1", "p");
      const editable = editableOf(container, "prose-1")!;
      editable.textContent = "Discard me";
      fireEvent.keyDown(editable, { key: "Escape" });
      expect(onCommitInlineEdit).not.toHaveBeenCalled();
      expect(container.querySelector(EDITABLE)).toBeNull();
    });

    it("preserves NEWLINES for a multiline field on commit", () => {
      const { container, onCommitInlineEdit } = openSession("prose-1", "p");
      const editable = editableOf(container, "prose-1")!;
      editable.innerHTML = "Edited line 1<br>Edited line 2";
      fireEvent.blur(editable);
      expect(onCommitInlineEdit).toHaveBeenCalledWith("prose-1", "children", "Edited line 1\nEdited line 2", 0);
    });

    it("Enter does NOT commit a MULTILINE field (it inserts a newline instead)", () => {
      const { container, onCommitInlineEdit } = openSession("prose-1", "p");
      fireEvent.keyDown(editableOf(container, "prose-1")!, { key: "Enter" });
      expect(onCommitInlineEdit).not.toHaveBeenCalled();
      expect(editableOf(container, "prose-1")).not.toBeNull(); // still editing
    });
  });

  describe("IME-safe commit", () => {
    it("Enter during composition does NOT commit; the next Enter after it commits ONCE", () => {
      const { container, onCommitInlineEdit } = openSession("h-1", "h2", doc([
        node("h-1", "ui.section-heading", { heading: "Compose", as: "h2" }),
      ]));
      const editable = editableOf(container, "h-1")!;

      act(() => editable.dispatchEvent(new Event("compositionstart", { bubbles: true })));
      // The composition's confirming Enter (isComposing / keyCode 229) must NOT commit.
      act(() =>
        editable.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }),
        ),
      );
      expect(onCommitInlineEdit).not.toHaveBeenCalled();

      act(() => editable.dispatchEvent(new Event("compositionend", { bubbles: true })));
      editable.textContent = "日本語";
      act(() =>
        editable.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", isComposing: false, bubbles: true, cancelable: true }),
        ),
      );
      expect(onCommitInlineEdit).toHaveBeenCalledTimes(1);
      expect(onCommitInlineEdit).toHaveBeenCalledWith("h-1", "heading", "日本語", 0);
    });

    it("also treats keyCode 229 as an in-flight composition", () => {
      const { container, onCommitInlineEdit } = openSession("h-1", "h2", doc([
        node("h-1", "ui.section-heading", { heading: "Compose", as: "h2" }),
      ]));
      const editable = editableOf(container, "h-1")!;
      act(() =>
        editable.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true }),
        ),
      );
      expect(onCommitInlineEdit).not.toHaveBeenCalled();
    });
  });

  describe("caret survival + no duplication", () => {
    it("the editable DOM node survives an unrelated re-render and keeps its content", () => {
      const onCommitInlineEdit = vi.fn();
      const props = {
        document: SPLIT,
        entries: composerEntries,
        session: { ...EDIT, selectedId: "prose-1" } as PreviewSession,
        onSelect: vi.fn(),
        onRequestAdd: vi.fn(),
        onRequestNodeMenu: vi.fn(),
        onRequestInsertMenu: vi.fn(),
        onCommitInlineEdit,
      };
      const { container, rerender } = render(h(CompositionCanvas, props));
      fireEvent.click(container.querySelector('[data-zc-node-id="prose-1"] p')!);
      const before = editableOf(container, "prose-1")!;
      expect(before.textContent).toBe("First paragraph.");

      // An unrelated session change (theme) must not reset the caret: same DOM
      // node, same imperative content, still editable, no commit.
      rerender(h(CompositionCanvas, { ...props, session: { ...props.session, theme: "dark" } }));
      const after = editableOf(container, "prose-1")!;
      expect(after).toBe(before);
      expect(after.textContent).toBe("First paragraph.");
      expect(after.getAttribute("contenteditable")).toBe("true");
      expect(onCommitInlineEdit).not.toHaveBeenCalled();
    });

    it("leaves NO duplicate text node after exiting the session", () => {
      const { container, onCommitInlineEdit } = openSession("prose-1", "p");
      const editable = editableOf(container, "prose-1")!;
      editable.textContent = "Committed copy.";
      fireEvent.blur(editable);
      expect(onCommitInlineEdit).toHaveBeenCalled();

      const paragraphs = container.querySelectorAll('[data-zc-node-id="prose-1"] > p');
      expect(paragraphs).toHaveLength(1);
      // Read-mode paragraph shows the document's (still original) value — exactly
      // one text node, and no lingering contentEditable.
      expect(paragraphs[0]!.childNodes).toHaveLength(1);
      expect(container.querySelector(EDITABLE)).toBeNull();
    });
  });

  describe("decorated component: the editable is a decoration-free label region", () => {
    it("targets the label wrapper (not the <a>), keeps the arrow OUTSIDE it, and commits ONLY the label", () => {
      const { container, onCommitInlineEdit } = openSession("cta", "a", doc([
        node("cta", "ui.cta-button", { href: "/x", children: "Get started", arrow: true }),
      ]));
      const editable = editableOf(container, "cta")!;
      // The inline-editor adapter resolves to the label wrapper, so the
      // contenteditable host holds ONLY editable text — no decoration island
      // inside it to break select-all/replace (the prepend bug).
      expect(editable.tagName).toBe("SPAN");
      expect(editable.hasAttribute("data-cta-label")).toBe(true);
      // The arrow decoration is a SIBLING outside the editable host.
      expect(editable.querySelector('[aria-hidden="true"]')).toBeNull();
      const arrow = editable.parentElement!.querySelector('[aria-hidden="true"]')!;
      expect(arrow).not.toBeNull();

      // Edit the label text node and commit only the label.
      (editable.firstChild as Text).data = "Go now";
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onCommitInlineEdit).toHaveBeenCalledWith("cta", "children", "Go now", 0);
    });
  });

  describe("dblclick guard", () => {
    it("a dblclick inside the active session does not bubble to the canvas (word-select can't restart it)", () => {
      const { container } = openSession("cta", "a", doc([
        node("cta", "ui.cta-button", { href: "/x", children: "Label", arrow: true }),
      ]));
      const editable = editableOf(container, "cta")!;
      (editable.firstChild as Text).data = "Typed label";

      const canvasSpy = vi.fn();
      container.querySelector(".zc-canvas")!.addEventListener("dblclick", canvasSpy);
      fireEvent.dblClick(editable);

      // Propagation stopped: the canvas never saw it, so the session was not
      // restarted and the typing is preserved on the SAME node.
      expect(canvasSpy).not.toHaveBeenCalled();
      expect(editableOf(container, "cta")).toBe(editable);
      expect((editable.firstChild as Text).data).toBe("Typed label");
    });
  });

  describe("switching to Preview mid-edit commits the draft", () => {
    it("commits the in-flight value when the mode flips to preview", () => {
      const onCommitInlineEdit = vi.fn();
      const document = doc([node("h-1", "ui.section-heading", { heading: "Compose", as: "h2" })]);
      const props = {
        document,
        entries: composerEntries,
        session: { ...EDIT, selectedId: "h-1" } as PreviewSession,
        onSelect: vi.fn(),
        onRequestAdd: vi.fn(),
        onRequestNodeMenu: vi.fn(),
        onRequestInsertMenu: vi.fn(),
        onCommitInlineEdit,
      };
      const { container, rerender } = render(h(CompositionCanvas, props));
      fireEvent.click(container.querySelector('[data-zc-node-id="h-1"] h2')!);
      const editable = editableOf(container, "h-1")!;
      editable.textContent = "Draft heading";

      act(() => rerender(h(CompositionCanvas, { ...props, session: { ...props.session, mode: "preview" } })));

      expect(onCommitInlineEdit).toHaveBeenCalledTimes(1);
      expect(onCommitInlineEdit).toHaveBeenCalledWith("h-1", "heading", "Draft heading", 0);
    });
  });

  // The ~774 "switching to Preview mid-edit commits the draft" test flips
  // MODE — a different effect entirely. These cover a mid-edit RENDER while
  // STAYING in Edit mode (issue #288).
  describe("mid-edit document changes fail closed, staying in Edit mode (issue #288)", () => {
    it("stamps a commit with the SESSION-START revision, not the revision on screen at commit time", () => {
      const onCommitInlineEdit = vi.fn();
      const document = doc([node("h-1", "ui.section-heading", { heading: "Compose", as: "h2" })]);
      const props: CompositionCanvasProps = {
        document,
        entries: composerEntries,
        session: { ...EDIT, selectedId: "h-1" },
        revision: 5,
        onSelect: vi.fn(),
        onRequestAdd: vi.fn(),
        onRequestNodeMenu: vi.fn(),
        onRequestInsertMenu: vi.fn(),
        onCommitInlineEdit,
      };
      const { container, rerender } = render(h(CompositionCanvas, props));
      fireEvent.click(container.querySelector('[data-zc-node-id="h-1"] h2')!);
      const editable = editableOf(container, "h-1")!;
      editable.textContent = "Draft heading";

      // A render lands mid-edit that bumps the revision but leaves the edited
      // field's value untouched (an unrelated change elsewhere in the
      // document) — the session survives, but a later commit must still carry
      // the OLD (session-start) revision so the host's existing
      // `documentRevision < lastDocRevisionRef.current` gate correctly rejects
      // it as stale instead of it re-stamping itself as fresh.
      const nextDocument = doc([...document.root, node("aside-1", "ui.prose-p", { children: "Unrelated." })]);
      act(() => rerender(h(CompositionCanvas, { ...props, document: nextDocument, revision: 9 })));

      expect(editableOf(container, "h-1")).toBe(editable); // session survived
      fireEvent.blur(editable);

      expect(onCommitInlineEdit).toHaveBeenCalledWith("h-1", "heading", "Draft heading", 5);
    });

    it("cancels the active session when a mid-edit render changes the EDITED field's value", () => {
      const onCommitInlineEdit = vi.fn();
      const document = doc([node("h-1", "ui.section-heading", { heading: "Compose", as: "h2" })]);
      const props: CompositionCanvasProps = {
        document,
        entries: composerEntries,
        session: { ...EDIT, selectedId: "h-1" },
        revision: 5,
        onSelect: vi.fn(),
        onRequestAdd: vi.fn(),
        onRequestNodeMenu: vi.fn(),
        onRequestInsertMenu: vi.fn(),
        onCommitInlineEdit,
      };
      const { container, rerender } = render(h(CompositionCanvas, props));
      fireEvent.click(container.querySelector('[data-zc-node-id="h-1"] h2')!);
      const editable = editableOf(container, "h-1")!;
      editable.textContent = "Draft heading";

      // A concurrent change to the SAME node/field lands mid-edit — the
      // ground the user is typing on moved, so the session is abandoned
      // outright rather than risk a doomed (or coincidentally matching)
      // commit later.
      const collidedDocument = doc([
        node("h-1", "ui.section-heading", { heading: "Someone else's edit", as: "h2" }),
      ]);
      act(() =>
        rerender(h(CompositionCanvas, { ...props, document: collidedDocument, revision: 9 })),
      );

      // Session cancelled: no more editable region, and no commit was ever
      // silently sent for the abandoned draft.
      expect(container.querySelector("[data-zc-inline-editing]")).toBeNull();
      expect(onCommitInlineEdit).not.toHaveBeenCalled();
      // The DOM now shows the FRESH document's value, not the abandoned draft.
      expect(container.querySelector('[data-zc-node-id="h-1"] h2')!.textContent).toBe(
        "Someone else's edit",
      );
    });
  });

  describe("multiline newline guard (issue #288)", () => {
    it("does NOT insert a spurious newline before an INLINE element child", () => {
      const { container, onCommitInlineEdit } = openSession("prose-1", "p");
      const editable = editableOf(container, "prose-1")!;
      editable.innerHTML = "Hello <strong>world</strong> and <em>friends</em>.";
      fireEvent.blur(editable);
      expect(onCommitInlineEdit).toHaveBeenCalledWith(
        "prose-1",
        "children",
        "Hello world and friends.",
        0,
      );
    });

    it("still inserts a newline before a BLOCK-level element child", () => {
      const { container, onCommitInlineEdit } = openSession("prose-1", "p");
      const editable = editableOf(container, "prose-1")!;
      editable.innerHTML = "First line<div>Second line</div>";
      fireEvent.blur(editable);
      expect(onCommitInlineEdit).toHaveBeenCalledWith(
        "prose-1",
        "children",
        "First line\nSecond line",
        0,
      );
    });
  });
});

describe("reserved props never reach a real component", () => {
  // ProseP renders `<p {...rest} />`. Without the guard, a document carrying
  // `dangerouslySetInnerHTML` would inject raw HTML into a document that is
  // SAME-ORIGIN with /composer. The bridge refuses such a document outright
  // (protocol.test.ts); this is the renderer's own defence in depth, for the
  // paths that do not cross the bridge.
  it("strips dangerouslySetInnerHTML", () => {
    const document = doc([
      node("prose-1", "ui.prose-p", {
        children: "safe text",
        dangerouslySetInnerHTML: { __html: "<img src=x onerror='alert(1)'>" },
      }),
    ]);
    const { container } = draw(document, { session: PREVIEW });
    const paragraph = container.querySelector('[data-zc-node-id="prose-1"] > p')!;
    expect(paragraph.querySelector("img")).toBeNull();
    expect(paragraph.innerHTML).not.toContain("onerror");
    expect(paragraph.textContent).toBe("safe text");
  });

  it("strips a `key` prop, which would hijack the renderer's own keying", () => {
    const document = doc([
      node("prose-1", "ui.prose-p", { children: "text", key: "hijacked" }),
    ]);
    const { container } = draw(document, { session: PREVIEW });
    expect(container.querySelector('[data-zc-node-id="prose-1"] > p')).not.toBeNull();
  });
});

describe("recoverable failures", () => {
  // SplitLayout indexes a lookup table by `ratio`; a value outside its domain
  // (an older document, a hand-edited prop) makes it throw. The canvas must not
  // go blank — the failure is isolated, reported, and retryable.
  const BAD = doc([
    node("split-1", "ui.split-layout", { ratio: "50-50" }, { left: [], right: [] }),
    node("prose-1", "ui.prose-p", { children: "I still render." }),
  ]);

  it("isolates a throwing component and keeps the rest of the canvas alive", () => {
    const onNodeError = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { container } = draw(BAD, { onNodeError, session: PREVIEW });
      expect(container.querySelector(".zc-node-error")).not.toBeNull();
      expect(container.textContent).toContain("This component failed to render");
      expect(container.textContent).toContain("I still render.");
      expect(onNodeError).toHaveBeenCalledWith("split-1", expect.any(String));
    } finally {
      spy.mockRestore();
    }
  });

  it("offers a retry affordance", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { container } = draw(BAD, { session: PREVIEW });
      const retry = container.querySelector(".zc-node-error-retry")!;
      expect(retry.getAttribute("type")).toBe("button");
      expect(retry.hasAttribute("data-zc-affordance")).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("linked Global-template ownership", () => {
  it("projects local content into the outlet with owner-qualified runtime identity", () => {
    // The two canonical documents intentionally collide on the raw node id.
    // The source Stack owns the shell; the local Prose remains the only node
    // that can be selected or mutated in the consumer.
    const local = doc([node("collision", "ui.prose-p", { children: "Local content" })]);
    const source = {
      ...doc([node("collision", "ui.stack", {}, { content: [] })]),
      name: "Site shell",
    };
    const onSelect = vi.fn();
    const onRequestAdd = vi.fn();
    const onOpenSource = vi.fn();
    const { container } = draw(local, {
      localRecordId: "consumer-record",
      linked: {
        sourceRecordId: "source-record",
        sourceDocument: source,
        outlet: { id: "outlet-main", label: "Main content", target: { parentId: "collision", slotId: "content" } },
      },
      session: { ...EDIT, selectedId: "collision" },
      onSelect,
      onRequestAdd,
      onOpenSource,
    });

    const wrappers = [...container.querySelectorAll<HTMLElement>('[data-zc-node-id="collision"]')];
    expect(wrappers).toHaveLength(2);
    const sourceWrapper = wrappers.find((node) => node.dataset.zcOwner === "global-template")!;
    const localWrapper = wrappers.find((node) => node.dataset.zcOwner === "local")!;
    expect(sourceWrapper.dataset.zcRuntimeKey).not.toBe(localWrapper.dataset.zcRuntimeKey);
    expect(sourceWrapper.querySelector(":scope > .zc-chrome")).toBeNull();
    expect(localWrapper.hasAttribute("data-zc-selected")).toBe(true);
    expect(container.textContent).toContain("Linked Global template");
    expect(container.textContent).toContain("Locked");

    fireEvent.click(sourceWrapper);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('[data-zc-insert=":root:1"]')!);
    expect(onRequestAdd).toHaveBeenCalledWith({ parentId: null, slotId: "root", index: 1 });

    fireEvent.click(container.querySelector(".zc-linked-frame-open")!);
    expect(onOpenSource).toHaveBeenCalledWith("source-record");
  });
});

// ── Drag & drop (issue #258) ─────────────────────────────────────────────────
describe("drag & drop (issue #258)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // happy-dom has no `ondragstart`/`ondrop` element PROPERTY, so Preact can't
  // fold `onDragStart`→"dragstart" and instead registers the case-preserved
  // listener names ("DragStart", "DragEnd", "DragEnter", "DragOver",
  // "DragLeave", "Drop"). In a real browser those props exist and Preact uses
  // the lowercase names — this map only bridges the happy-dom test env.
  const PREACT_DRAG_EVENT: Record<string, string> = {
    dragstart: "DragStart",
    dragend: "DragEnd",
    dragenter: "DragEnter",
    dragover: "DragOver",
    dragleave: "DragLeave",
    drop: "Drop",
  };

  /** A minimal DragEvent stand-in: happy-dom has no DragEvent constructor, and
   *  Preact attaches on* handlers as plain DOM listeners, so a bubbling Event
   *  with the fields our handlers read (dataTransfer, altKey) is enough. */
  function dragEvent(type: string, props: Record<string, unknown> = {}): Event {
    const event = new Event(PREACT_DRAG_EVENT[type] ?? type, { bubbles: true, cancelable: true });
    Object.assign(event, props);
    return event;
  }

  function fakeDataTransfer() {
    const store: { id: string } = { id: "" };
    return {
      setData: vi.fn((_type: string, value: string) => {
        store.id = value;
      }),
      getData: vi.fn(() => store.id),
      effectAllowed: "",
      dropEffect: "",
    };
  }

  const gripOf = (container: HTMLElement, nodeId: string): HTMLElement | null =>
    container.querySelector(`[data-zc-node-id="${nodeId}"] > .zc-chrome > .zc-chrome-grip`);

  const groupOf = (container: HTMLElement, key: string): HTMLElement =>
    container.querySelector(`[data-zc-insert="${key}"]`)!.closest(".zc-insert-group") as HTMLElement;

  /** Start a drag from `nodeId`'s grip and flush the DEFERRED state mutation. */
  function startDrag(container: HTMLElement, nodeId: string, dt: ReturnType<typeof fakeDataTransfer>) {
    act(() => void gripOf(container, nodeId)!.dispatchEvent(dragEvent("dragstart", { dataTransfer: dt })));
    act(() => void vi.runOnlyPendingTimers());
  }

  describe("the drag grip", () => {
    it("renders ONLY on the selected, non-opaque node (and only with a drop sink)", () => {
      const { container } = draw(SPLIT, {
        session: { ...EDIT, selectedId: "prose-1" },
        onDropNode: vi.fn(),
      });
      expect(gripOf(container, "prose-1")).not.toBeNull();
      // An unselected node's own chrome has no grip.
      expect(gripOf(container, "split-1")).toBeNull();
    });

    it("is absent when no onDropNode sink is wired (feature off)", () => {
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" } });
      expect(gripOf(container, "prose-1")).toBeNull();
    });

    it("is absent on an opaque node — opaque nodes are not draggable", () => {
      const OPAQUE = doc([node("opaque-1", "ghost.unknown", { foo: 1 })]);
      const { container } = draw(OPAQUE, {
        session: { ...EDIT, selectedId: "opaque-1" },
        onDropNode: vi.fn(),
      });
      // It IS selected (opaque nodes stay selectable) …
      expect(container.querySelector('[data-zc-node-id="opaque-1"][data-zc-selected]')).not.toBeNull();
      // … but it has no drag grip.
      expect(gripOf(container, "opaque-1")).toBeNull();
    });

    it("is absent in Preview mode", () => {
      const { container } = draw(SPLIT, {
        session: { mode: "preview", theme: "light", selectedId: "prose-1" },
        onDropNode: vi.fn(),
      });
      expect(container.querySelector(".zc-chrome-grip")).toBeNull();
    });
  });

  describe("dragstart: synchronous setData, deferred state mutation (the #1 footgun)", () => {
    it("calls dataTransfer.setData synchronously but does NOT mutate renderer state until deferred", () => {
      const { container } = draw(SPLIT, {
        session: { ...EDIT, selectedId: "prose-1" },
        onDropNode: vi.fn(),
      });
      const dt = fakeDataTransfer();
      const canvas = container.querySelector(".zc-canvas")!;

      act(() => void gripOf(container, "prose-1")!.dispatchEvent(dragEvent("dragstart", { dataTransfer: dt })));
      // setData ran SYNCHRONOUSLY with the source node id …
      expect(dt.setData).toHaveBeenCalledWith("text/plain", "prose-1");
      expect(dt.effectAllowed).toBe("copyMove");
      // … but the dragging state is still deferred (a synchronous setState here
      // cancels the drag in Chromium).
      expect(canvas.hasAttribute("data-zc-dragging")).toBe(false);

      act(() => void vi.runOnlyPendingTimers());
      expect(canvas.hasAttribute("data-zc-dragging")).toBe(true);
    });
  });

  describe("valid-target highlighting", () => {
    it("highlights every valid insert point and EXCLUDES points inside the dragged subtree", () => {
      const { container } = draw(SPLIT, {
        session: { ...EDIT, selectedId: "stack-1" },
        onDropNode: vi.fn(),
      });
      startDrag(container, "stack-1", fakeDataTransfer());

      // A root-level and a split-slot insert point are valid targets.
      expect(groupOf(container, ":root:0").hasAttribute("data-zc-drop-valid")).toBe(true);
      expect(groupOf(container, "split-1:right:0").hasAttribute("data-zc-drop-valid")).toBe(true);
      // An insert point INSIDE the dragged stack's own subtree is invalid.
      expect(groupOf(container, "stack-1:content:0").hasAttribute("data-zc-drop-valid")).toBe(false);
    });

    it("gives the hovered target a STRONGER state, cleared on dragleave", () => {
      const { container } = draw(SPLIT, {
        session: { ...EDIT, selectedId: "prose-1" },
        onDropNode: vi.fn(),
      });
      const dt = fakeDataTransfer();
      startDrag(container, "prose-1", dt);
      const g = groupOf(container, ":root:0");

      act(() => void g.dispatchEvent(dragEvent("dragenter", { dataTransfer: dt })));
      expect(g.hasAttribute("data-zc-drop-active")).toBe(true);

      act(() => void g.dispatchEvent(dragEvent("dragleave", { dataTransfer: dt })));
      expect(g.hasAttribute("data-zc-drop-active")).toBe(false);
    });

    it("marks the canvas data-zc-dragging — the CSS hook for the pointer-events guard", () => {
      const { container } = draw(SPLIT, {
        session: { ...EDIT, selectedId: "prose-1" },
        onDropNode: vi.fn(),
      });
      startDrag(container, "prose-1", fakeDataTransfer());
      expect(container.querySelector(".zc-canvas")!.hasAttribute("data-zc-dragging")).toBe(true);
    });
  });

  describe("drop", () => {
    it("emits onDropNode with the source id, the target, and copy=false (no Alt)", () => {
      const onDropNode = vi.fn();
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" }, onDropNode });
      const dt = fakeDataTransfer();
      startDrag(container, "prose-1", dt);
      const g = groupOf(container, ":root:1");

      act(() => void g.dispatchEvent(dragEvent("dragover", { dataTransfer: dt, altKey: false })));
      act(() => void g.dispatchEvent(dragEvent("drop", { dataTransfer: dt, altKey: false })));

      expect(onDropNode).toHaveBeenCalledWith(
        "prose-1",
        { parentId: null, slotId: "root", index: 1 },
        false,
      );
    });

    it("emits copy=true when Alt is held at drop", () => {
      const onDropNode = vi.fn();
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" }, onDropNode });
      const dt = fakeDataTransfer();
      startDrag(container, "prose-1", dt);
      const g = groupOf(container, "split-1:right:0");

      act(() => void g.dispatchEvent(dragEvent("drop", { dataTransfer: dt, altKey: true })));

      expect(onDropNode).toHaveBeenCalledWith(
        "prose-1",
        { parentId: "split-1", slotId: "right", index: 0 },
        true,
      );
    });

    it("does NOT emit for a target inside the dragged subtree (advisory guard holds)", () => {
      const onDropNode = vi.fn();
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "stack-1" }, onDropNode });
      const dt = fakeDataTransfer();
      startDrag(container, "stack-1", dt);
      const g = groupOf(container, "stack-1:content:0");

      act(() => void g.dispatchEvent(dragEvent("drop", { dataTransfer: dt })));

      expect(onDropNode).not.toHaveBeenCalled();
    });
  });

  describe("dragend clears the drag state UNCONDITIONALLY", () => {
    it("clears on a plain cancel (no drop)", () => {
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" }, onDropNode: vi.fn() });
      const canvas = container.querySelector(".zc-canvas")!;
      startDrag(container, "prose-1", fakeDataTransfer());
      expect(canvas.hasAttribute("data-zc-dragging")).toBe(true);

      act(() => void gripOf(container, "prose-1")!.dispatchEvent(dragEvent("dragend")));
      expect(canvas.hasAttribute("data-zc-dragging")).toBe(false);
    });

    it("clears after a completed drop too", () => {
      const onDropNode = vi.fn();
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" }, onDropNode });
      const canvas = container.querySelector(".zc-canvas")!;
      const dt = fakeDataTransfer();
      startDrag(container, "prose-1", dt);
      const g = groupOf(container, ":root:0");
      act(() => void g.dispatchEvent(dragEvent("drop", { dataTransfer: dt })));
      act(() => void gripOf(container, "prose-1")!.dispatchEvent(dragEvent("dragend")));

      expect(onDropNode).toHaveBeenCalledTimes(1);
      expect(canvas.hasAttribute("data-zc-dragging")).toBe(false);
      // The highlight state is gone with it.
      expect(container.querySelector("[data-zc-drop-valid]")).toBeNull();
    });
  });

  // ── A7 regression (issue #283) ──────────────────────────────────────────
  // The end-of-slot insert point's markup was restructured (enlarged button +
  // dots overlapping its trailing edge instead of sitting inline). Both the
  // DnD drop-target wiring and the insert-menu focus-restore token must still
  // resolve against the NEW structure exactly as they did against the old
  // slim-bar one — this is not just an "add button click still works" check.
  describe("A7: DnD + focus-restore still work against the restructured END insert point (#283)", () => {
    it("still highlights the END insert point as a valid drop target and accepts a drop on it", () => {
      const onDropNode = vi.fn();
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "prose-1" }, onDropNode });
      const dt = fakeDataTransfer();
      startDrag(container, "prose-1", dt);

      // stack-1's `content` slot has 2 children → index 2 is the END point,
      // now rendered as `.zc-insert-end--vertical` rather than
      // `.zc-insert-group--vertical`.
      const endGroup = groupOf(container, "stack-1:content:2");
      expect(endGroup.className).toContain("zc-insert-end--vertical");
      expect(endGroup.hasAttribute("data-zc-drop-valid")).toBe(true);

      act(() => void endGroup.dispatchEvent(dragEvent("dragover", { dataTransfer: dt, altKey: false })));
      act(() => void endGroup.dispatchEvent(dragEvent("drop", { dataTransfer: dt, altKey: false })));

      expect(onDropNode).toHaveBeenCalledWith(
        "prose-1",
        { parentId: "stack-1", slotId: "content", index: 2 },
        false,
      );
    });

    it("excludes the END insert point when it sits inside the dragged subtree", () => {
      const { container } = draw(SPLIT, { session: { ...EDIT, selectedId: "stack-1" }, onDropNode: vi.fn() });
      startDrag(container, "stack-1", fakeDataTransfer());
      // stack-1's own content:2 END point is inside stack-1's own subtree.
      expect(groupOf(container, "stack-1:content:2").hasAttribute("data-zc-drop-valid")).toBe(false);
    });

    it("focusByToken still finds and focuses the END point's overlapping dots trigger", () => {
      const { container } = draw(SPLIT);
      document.body.append(container);
      try {
        focusByToken("insert-menu:stack-1:content:2");
        const expected = container
          .querySelector('[data-zc-insert="stack-1:content:2"]')!
          .closest(".zc-insert-group")!
          .querySelector(".zc-insert-menu--end");
        expect(expected).not.toBeNull();
        expect(document.activeElement).toBe(expected);
      } finally {
        container.remove();
      }
    });
  });
});
