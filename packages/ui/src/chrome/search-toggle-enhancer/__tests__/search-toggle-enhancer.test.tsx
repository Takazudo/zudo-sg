import { fireEvent, render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SiteHeader, type BrandSwitcherItem } from "../../site-header/site-header";
import SearchToggleEnhancer from "../search-toggle-enhancer";

const ITEMS: BrandSwitcherItem[] = [
  { key: "corporate", label: "Corporate", href: "/", mark: "○", description: "d", domain: "acme.example", current: true },
];

// aria-expanded sync runs inside a queueMicrotask (see search-toggle-enhancer.tsx),
// so assertions on it must wait a tick for that microtask to flush.
const flush = () => Promise.resolve();

function setup() {
  render(
    <>
      <SiteHeader switcherItems={ITEMS} />
      <SearchToggleEnhancer />
    </>,
  );
  const form = document.querySelector("[data-search-form]") as HTMLElement;
  const trigger = form.querySelector("[data-search-trigger]") as HTMLElement;
  const input = form.querySelector("[data-search-input]") as HTMLInputElement;
  return { form, trigger, input };
}

describe("SearchToggleEnhancer", () => {
  it("focuses the input and syncs aria-expanded on click", async () => {
    const { trigger, input } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    await flush();
    expect(document.activeElement).toBe(input);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("clicking again clears the input and returns focus to the trigger", async () => {
    const { trigger, input } = setup();
    fireEvent.click(trigger); // focuses input
    await flush();
    input.value = "widgets";
    fireEvent.click(trigger); // toggle-close
    await flush();
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(trigger);
    // The trigger itself is inside `[data-search-form]`, so it staying focused
    // keeps focus-within (and so aria-expanded) true — only Tab-ing (or
    // clicking) away from the form entirely fully collapses it.
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("syncs aria-expanded via plain focus/blur too, not just click", async () => {
    const { trigger, input } = setup();
    input.focus();
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    input.blur();
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape clears the input and returns focus to the trigger", async () => {
    const { trigger, input } = setup();
    input.focus();
    input.value = "widgets";
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(trigger);
    // Same as the click-toggle case: the trigger is inside the form, so
    // aria-expanded stays true while it holds focus.
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("fully collapses (aria-expanded false) once focus leaves the form entirely", async () => {
    const { trigger, input } = setup();
    input.focus();
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not double-bind when mounted twice (idempotency guard)", async () => {
    render(
      <>
        <SiteHeader switcherItems={ITEMS} />
        <SearchToggleEnhancer />
        <SearchToggleEnhancer />
      </>,
    );
    const form = document.querySelector("[data-search-form]") as HTMLElement;
    const trigger = form.querySelector("[data-search-trigger]") as HTMLElement;
    const input = form.querySelector("[data-search-input]") as HTMLInputElement;
    fireEvent.click(trigger);
    await flush();
    // A double-bound click handler would focus then immediately un-focus.
    expect(document.activeElement).toBe(input);
  });
});
