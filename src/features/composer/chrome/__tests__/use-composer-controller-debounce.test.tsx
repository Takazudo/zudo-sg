// Debounced inspector commit channel — controller-level proof (issue #291).
//
// `updatePropsDebounced` coalesces per-keystroke patches and dispatches once
// per typing pause; these tests pin the deterministic-flush guarantees the
// design leans on:
//   - a keystroke burst → exactly ONE trailing persist, final value lands
//   - `flushPropUpdates` lands pending synchronously and returns the fresh
//     document in the same tick (the export seam)
//   - ANY other action (setMode / remove / …) flushes pending FIRST, so the
//     reducer sees events in user order (this is also the Edit→Preview
//     mode-switch flush path)
//   - unmount and the navigation guard flush pending
//
// Fake timers are restricted to setTimeout/clearTimeout so Preact's
// microtask-based render scheduling stays real.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/preact";
import { createSequentialIdFactory, type CompositionDocument } from "@/composer";
import { fixtureManifest, makeAbcDocument, resetFixtureIds } from "@/composer/__tests__/fixtures";
import { INSPECTOR_COMMIT_DEBOUNCE_MS, useComposerController } from "../use-composer-controller";
import { COMPOSER_DOCUMENT_STORAGE_KEY } from "../storage";
import { BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

function setup() {
  resetFixtureIds();
  return renderHook(() =>
    useComposerController({
      manifest: fixtureManifest,
      sample: makeAbcDocument(),
      idFactory: createSequentialIdFactory("n"),
    }),
  );
}

function labelOfA(doc: CompositionDocument): unknown {
  return doc.root[0]!.slots.left![0]!.props.label;
}

function persistedLabelOfA(): unknown {
  return labelOfA(JSON.parse(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)!));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useComposerController — debounced updateProps channel (#291)", () => {
  it("coalesces a keystroke burst into ONE trailing persist; the final value always lands", () => {
    const { result } = setup();
    const setItem = vi.spyOn(localStorage, "setItem");

    act(() => {
      result.current.updatePropsDebounced("A", { label: "H" });
      result.current.updatePropsDebounced("A", { label: "He" });
      result.current.updatePropsDebounced("A", { label: "Hello" });
    });

    // Nothing dispatched during the burst — document and storage untouched.
    expect(labelOfA(result.current.state.document)).toBe("A");
    expect(setItem).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(INSPECTOR_COMMIT_DEBOUNCE_MS));

    expect(labelOfA(result.current.state.document)).toBe("Hello");
    const writes = setItem.mock.calls.filter(([key]) => key === COMPOSER_DOCUMENT_STORAGE_KEY);
    expect(writes).toHaveLength(1);
    expect(labelOfA(JSON.parse(writes[0]![1] as string))).toBe("Hello");
  });

  it("is trailing-edge: each keystroke inside the window resets the timer", () => {
    const { result } = setup();

    act(() => result.current.updatePropsDebounced("A", { label: "part" }));
    act(() => vi.advanceTimersByTime(INSPECTOR_COMMIT_DEBOUNCE_MS - 1));
    act(() => result.current.updatePropsDebounced("A", { label: "partial" }));
    act(() => vi.advanceTimersByTime(INSPECTOR_COMMIT_DEBOUNCE_MS - 1));

    // Still pending — the second keystroke restarted the window.
    expect(labelOfA(result.current.state.document)).toBe("A");

    act(() => vi.advanceTimersByTime(1));
    expect(labelOfA(result.current.state.document)).toBe("partial");
  });

  it("flushPropUpdates lands the pending patch synchronously and returns the post-flush document", () => {
    const { result } = setup();
    act(() => result.current.updatePropsDebounced("A", { label: "Typed" }));

    let flushed: CompositionDocument | null = null;
    act(() => {
      flushed = result.current.flushPropUpdates();
    });

    expect(labelOfA(flushed!)).toBe("Typed");
    expect(result.current.state.document).toBe(flushed);
    expect(persistedLabelOfA()).toBe("Typed");

    // The cancelled timer must not re-dispatch later.
    const setItem = vi.spyOn(localStorage, "setItem");
    act(() => vi.advanceTimersByTime(INSPECTOR_COMMIT_DEBOUNCE_MS * 2));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("merges patches per node and lands multiple pending nodes on one flush", () => {
    const { result } = setup();
    act(() => {
      result.current.updatePropsDebounced("A", { label: "A2" });
      result.current.updatePropsDebounced("B", { label: "B2" });
    });
    act(() => vi.advanceTimersByTime(INSPECTOR_COMMIT_DEBOUNCE_MS));

    expect(labelOfA(result.current.state.document)).toBe("A2");
    expect(result.current.state.document.root[0]!.slots.right![0]!.props.label).toBe("B2");
  });

  it("setMode flushes the pending patch FIRST — the Edit→Preview mode-switch flush path", () => {
    const { result } = setup();
    act(() => {
      result.current.updatePropsDebounced("A", { label: "Switched" });
      result.current.setMode("preview");
    });

    // No timer advance: the mode switch itself landed the pending commit.
    expect(result.current.state.mode).toBe("preview");
    expect(labelOfA(result.current.state.document)).toBe("Switched");
    expect(persistedLabelOfA()).toBe("Switched");
  });

  it("a structural action flushes pending first, so a patch never targets an already-removed node", () => {
    const { result } = setup();
    act(() => {
      result.current.updatePropsDebounced("A", { label: "Final words" });
      result.current.remove("A");
    });

    // Had the patch been dispatched AFTER the remove, updateProps would have
    // errored on the missing node and surfaced via lastError.
    expect(result.current.lastError).toBeNull();
    expect(result.current.state.document.root[0]!.slots.left).toHaveLength(0);
  });

  it("reload lands the pending edit before re-reading storage, so state and storage never diverge", () => {
    const { result } = setup();
    act(() => result.current.updatePropsDebounced("A", { label: "Pre-reload" }));

    act(() => result.current.reload());

    expect(labelOfA(result.current.state.document)).toBe("Pre-reload");
    expect(persistedLabelOfA()).toBe("Pre-reload");
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
  });

  it("unmount flushes the pending patch to storage", () => {
    const { result, unmount } = setup();
    act(() => result.current.updatePropsDebounced("A", { label: "Almost lost" }));

    unmount();

    expect(persistedLabelOfA()).toBe("Almost lost");
  });

  it("the navigation guard flushes pending, so leaving mid-burst saves instead of losing the tail", () => {
    const { result } = setup();
    act(() => result.current.updatePropsDebounced("A", { label: "Guarded" }));

    let blocked = false;
    act(() => {
      blocked = !document.dispatchEvent(new Event(BEFORE_NAVIGATE_EVENT, { cancelable: true }));
    });

    // The flush landed + autosaved the edit — nothing left unsaved to block on.
    expect(blocked).toBe(false);
    expect(persistedLabelOfA()).toBe("Guarded");
    expect(result.current.state.saveStatus).toEqual({ kind: "saved" });
  });
});
