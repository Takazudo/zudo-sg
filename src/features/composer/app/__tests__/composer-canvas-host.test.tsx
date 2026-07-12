/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Canvas host + REAL #248 bridge, wired through a recording frame / deliverable
// host (no live iframe). Proves the parent-side lifecycle: retain-until-ready,
// ready replay, document render vs. session-only update, inbound select /
// request-add (+ focus restoration seam) / recoverable error, and viewport
// sizing — issue #251 scope items 2, 3, 5.

import { describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import { fireEvent, render, screen } from "@testing-library/preact";
import { createSampleDocument } from "@/composer";
import {
  errorMessage,
  modeMessage,
  readyMessage,
  requestAddMessage,
  selectMessage,
} from "@/features/composer/preview/protocol";
import type { PreviewSession } from "@/features/composer/preview";
import { ComposerCanvasHost } from "../composer-canvas-host";
import { makeTestBridge } from "../test-support/preview-harness";

const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (v: unknown) => v as any;

function mount(overrides: Partial<Parameters<typeof ComposerCanvasHost>[0]> = {}) {
  const bridge = makeTestBridge();
  const onSelect = vi.fn();
  const onRequestAdd = vi.fn();
  const doc = createSampleDocument();
  doc.name = "first";
  const utils = render(
    <ComposerCanvasHost
      document={doc}
      session={EDIT}
      viewport="fluid"
      onSelect={onSelect}
      onRequestAdd={onRequestAdd}
      createBridge={bridge.createBridge}
      location={bridge.location}
      {...overrides}
    />,
  );
  return { bridge, onSelect, onRequestAdd, doc, ...utils };
}

describe("ComposerCanvasHost — bridge lifecycle (#251)", () => {
  it("holds the initial snapshot until ready, then replays it to the exact origin", () => {
    const { bridge } = mount();
    expect(bridge.posts).toHaveLength(0);

    act(() => bridge.deliver(readyMessage()));

    expect(bridge.posts).toHaveLength(1);
    expect(asAny(bridge.posts[0].message).type).toBe("render");
    expect(asAny(bridge.posts[0].message).document.name).toBe("first");
    expect(bridge.posts[0].targetOrigin).toBe(bridge.location.targetOrigin);
  });

  it("a document change re-renders; a session-only change is a lighter update", () => {
    const { bridge, doc, rerender, onSelect, onRequestAdd } = mount();
    act(() => bridge.deliver(readyMessage()));
    bridge.posts.length = 0;

    const doc2 = createSampleDocument();
    doc2.name = "second";
    rerender(
      <ComposerCanvasHost
        document={doc2}
        session={EDIT}
        viewport="fluid"
        onSelect={onSelect}
        onRequestAdd={onRequestAdd}
        createBridge={bridge.createBridge}
        location={bridge.location}
      />,
    );
    expect(asAny(bridge.posts.at(-1)!.message).type).toBe("render");
    expect(asAny(bridge.posts.at(-1)!.message).document.name).toBe("second");

    // Same document reference, new session object → updateSession (mode msg).
    rerender(
      <ComposerCanvasHost
        document={doc2}
        session={{ mode: "preview", theme: "light", selectedId: null }}
        viewport="fluid"
        onSelect={onSelect}
        onRequestAdd={onRequestAdd}
        createBridge={bridge.createBridge}
        location={bridge.location}
      />,
    );
    expect(asAny(bridge.posts.at(-1)!.message).type).toBe("mode");
    expect(asAny(bridge.posts.at(-1)!.message).session.mode).toBe("preview");
    expect(doc).toBeDefined();
  });

  it("routes an inbound canvas selection to onSelect", () => {
    const { bridge, onSelect } = mount();
    act(() => bridge.deliver(readyMessage()));
    act(() => bridge.deliver(selectMessage(3, "node-x")));
    expect(onSelect).toHaveBeenCalledWith("node-x");
  });

  it("on request-add focuses the iframe (focus-return seam) and forwards the target", () => {
    const { bridge, onRequestAdd, container } = mount();
    act(() => bridge.deliver(readyMessage()));
    const target = { parentId: null, slotId: "root", index: 0 };
    act(() => bridge.deliver(requestAddMessage(4, target)));
    expect(onRequestAdd).toHaveBeenCalledWith(target);
    expect(document.activeElement).toBe(container.querySelector("iframe"));
  });

  it("surfaces a recoverable renderer error as a dismissible banner", () => {
    const { bridge } = mount();
    act(() => bridge.deliver(readyMessage()));
    act(() => bridge.deliver(errorMessage(5, "node threw", true)));
    expect(screen.getByText(/Preview error: node threw/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Preview error/)).not.toBeInTheDocument();
  });

  it("sizes the frame to the chosen viewport width (preview width only)", () => {
    const { bridge, container, rerender, onSelect, onRequestAdd, doc } = mount();
    const frame = () => container.querySelector(".sg-composer-canvas-frame") as HTMLElement;
    // fluid → no fixed width
    expect(frame().style.width).toBe("");
    rerender(
      <ComposerCanvasHost
        document={doc}
        session={EDIT}
        viewport="tablet"
        onSelect={onSelect}
        onRequestAdd={onRequestAdd}
        createBridge={bridge.createBridge}
        location={bridge.location}
      />,
    );
    expect(frame().style.width).toBe("768px");
    expect(frame().style.maxWidth).toBe("100%");
  });

  it("ignores an error the renderer marked non-recoverable (no false banner)", () => {
    const { bridge } = mount();
    act(() => bridge.deliver(readyMessage()));
    act(() => bridge.deliver(errorMessage(6, "fatal", false)));
    expect(screen.queryByText(/Preview error/)).not.toBeInTheDocument();
  });
});
