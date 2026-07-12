import { afterEach, describe, expect, it, vi } from "vitest";
import { BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import {
  createBeforeNavigateHandler,
  createBeforeUnloadHandler,
  installComposerNavigationGuard,
} from "../navigation-guard";

describe("createBeforeNavigateHandler", () => {
  it("prevents the router's soft-swap when there are unsaved edits", () => {
    const handler = createBeforeNavigateHandler(() => true);
    const event = { preventDefault: vi.fn() };
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("lets the navigation through untouched when everything is saved", () => {
    const handler = createBeforeNavigateHandler(() => false);
    const event = { preventDefault: vi.fn() };
    handler(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("createBeforeUnloadHandler", () => {
  function mockEvent(): BeforeUnloadEvent {
    return { preventDefault: vi.fn(), returnValue: "" } as unknown as BeforeUnloadEvent;
  }

  it("arms the native prompt when there are unsaved edits", () => {
    const handler = createBeforeUnloadHandler(() => true);
    const event = mockEvent();
    const result = handler(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe("");
    expect(result).toBe("");
  });

  it("does nothing when everything is saved", () => {
    const handler = createBeforeUnloadHandler(() => false);
    const event = mockEvent();
    const result = handler(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

describe("installComposerNavigationGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wires a BEFORE_NAVIGATE_EVENT listener that prevents default while unsaved", () => {
    let unsaved = true;
    const dispose = installComposerNavigationGuard(() => unsaved);

    const event = new Event(BEFORE_NAVIGATE_EVENT, { cancelable: true });
    const prevented = !document.dispatchEvent(event);
    expect(prevented).toBe(true);

    unsaved = false;
    const event2 = new Event(BEFORE_NAVIGATE_EVENT, { cancelable: true });
    const prevented2 = !document.dispatchEvent(event2);
    expect(prevented2).toBe(false);

    dispose();
  });

  it("the disposer removes both listeners", () => {
    const addDocSpy = vi.spyOn(document, "addEventListener");
    const removeDocSpy = vi.spyOn(document, "removeEventListener");
    const addWinSpy = vi.spyOn(window, "addEventListener");
    const removeWinSpy = vi.spyOn(window, "removeEventListener");

    const dispose = installComposerNavigationGuard(() => true);
    expect(addDocSpy).toHaveBeenCalledWith(BEFORE_NAVIGATE_EVENT, expect.any(Function));
    expect(addWinSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    dispose();
    expect(removeDocSpy).toHaveBeenCalledWith(BEFORE_NAVIGATE_EVENT, expect.any(Function));
    expect(removeWinSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
