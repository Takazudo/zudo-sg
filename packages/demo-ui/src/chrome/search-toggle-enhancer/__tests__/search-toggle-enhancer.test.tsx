import { describe, expect, it, vi } from "vitest";
import { fire, flushAll, renderIsland } from "../../../test-utils/zudo-react.js";
import { SiteHeader } from "../../site-header/site-header";
import SearchToggleEnhancer from "../search-toggle-enhancer";

function SearchToggleFixture({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <>
      <SiteHeader />
      <SearchToggleEnhancer />
      {duplicate && <SearchToggleEnhancer />}
    </>
  );
}

function setup() {
  const app = renderIsland(SearchToggleFixture, {});
  const form = app.container.querySelector("[data-search-form]") as HTMLElement;
  const trigger = form.querySelector("[data-search-trigger]") as HTMLElement;
  const input = form.querySelector("[data-search-input]") as HTMLInputElement;
  return { app, form, trigger, input };
}

describe("SearchToggleEnhancer", () => {
  it("focuses the input and syncs aria-expanded on click", async () => {
    const { app, trigger, input } = setup();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fire(trigger, "click");
    await app.flush();
    expect(document.activeElement).toBe(input);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("clicking again clears the input and returns focus to the trigger", async () => {
    const { app, trigger, input } = setup();

    fire(trigger, "click");
    await app.flush();
    input.value = "widgets";
    fire(trigger, "click");
    await app.flush();

    expect(input.value).toBe("");
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("syncs aria-expanded via plain focus/blur too, not just click", async () => {
    const { app, trigger, input } = setup();

    input.focus();
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    input.blur();
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("Escape clears the input and returns focus to the trigger", async () => {
    const { app, trigger, input } = setup();
    input.focus();
    input.value = "widgets";

    fire(input, "keydown", { key: "Escape" });
    await app.flush();

    expect(input.value).toBe("");
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("fully collapses once focus leaves the form entirely", async () => {
    const { app, trigger, input } = setup();
    input.focus();
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    await app.flush();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    outside.remove();
  });

  it("does not double-bind when mounted twice (idempotency guard)", async () => {
    const app = renderIsland(SearchToggleFixture, { duplicate: true });
    const input = app.container.querySelector("[data-search-input]") as HTMLInputElement;
    const trigger = app.container.querySelector("[data-search-trigger]") as HTMLElement;

    fire(trigger, "click");
    await app.flush();
    expect(document.activeElement).toBe(input);
  });

  it("removes focus and click handlers on disposal", async () => {
    const { app, form, trigger, input } = setup();
    const focus = vi.spyOn(input, "focus");
    app.dispose();
    fire(trigger, "click");
    await flushAll();

    expect(form.dataset.searchToggleEnhanced).toBeUndefined();
    expect(focus).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
