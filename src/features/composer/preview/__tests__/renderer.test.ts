// Renderer behaviour against the REAL #246 cohort and the REAL trusted registry
// — no stub components, so slot projection is proved against production
// `Stack` / `SplitLayout`, not against a lookalike.

import { describe, expect, it, vi } from "vitest";
import { h } from "preact";
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

  it("uses the vertical-BAR variant for a horizontal-flow container", () => {
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
    for (const point of points) expect(point.className).toContain("zc-insert--horizontal");
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
