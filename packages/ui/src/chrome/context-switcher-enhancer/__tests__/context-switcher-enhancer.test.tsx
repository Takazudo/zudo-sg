import { fireEvent, render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SiteHeader, type BrandSwitcherItem } from "../../site-header/site-header";
import ContextSwitcherEnhancer from "../context-switcher-enhancer";

const ITEMS: BrandSwitcherItem[] = [
  { key: "corporate", label: "Corporate", href: "/", mark: "○", description: "d", domain: "acme.example", current: true },
  { key: "vacuum", label: "Line A", href: "/lines/vacuum", mark: "A", description: "d", domain: "line-a.example", current: false },
];

// aria-expanded sync runs inside a queueMicrotask (see context-switcher-enhancer.tsx),
// so assertions on it must wait a tick for that microtask to flush.
const flush = () => Promise.resolve();

function setup() {
  render(
    <>
      <SiteHeader switcherItems={ITEMS} />
      <ContextSwitcherEnhancer />
    </>,
  );
  const trigger = document.querySelector("[data-ctx-trigger]") as HTMLElement;
  const panel = document.querySelector("[data-ctx-panel]") as HTMLElement;
  const card = panel.querySelector("[data-ctx-card-key]") as HTMLElement;
  return { trigger, panel, card };
}

describe("ContextSwitcherEnhancer", () => {
  it("opens and pins the panel on click, syncing aria-expanded", async () => {
    const { trigger, panel } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(panel.style.visibility).toBe("visible"); // inline style applies synchronously
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on a second click", async () => {
    const { trigger, panel } = setup();
    fireEvent.click(trigger); // open
    fireEvent.click(trigger); // close
    expect(panel.style.visibility).toBe("hidden");
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and returns focus to the trigger when focus was inside", async () => {
    const { trigger, panel, card } = setup();
    fireEvent.click(trigger); // open + pin
    await flush();
    card.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel.style.visibility).toBe("hidden");
    expect(document.activeElement).toBe(trigger);
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on an outside click", async () => {
    const { trigger, panel } = setup();
    fireEvent.click(trigger); // open + pin
    await flush();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    fireEvent.pointerDown(outside);
    expect(panel.style.visibility).toBe("hidden");
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not close on a click inside the panel", async () => {
    const { trigger, panel, card } = setup();
    fireEvent.click(trigger); // open + pin
    await flush();
    fireEvent.pointerDown(card);
    expect(panel.style.visibility).toBe("visible");
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("clears the pinned state when focus leaves the switcher entirely", async () => {
    const { trigger, panel, card } = setup();
    fireEvent.click(trigger); // open + pin
    await flush();
    card.focus();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus(); // real focus move — fires focusout on `card` with relatedTarget=outside
    // Cleared back to CSS-driven ("none"), not force-closed via inline styles.
    expect(panel.style.visibility).toBe("");
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not double-bind when mounted twice (idempotency guard)", async () => {
    render(
      <>
        <SiteHeader switcherItems={ITEMS} />
        <ContextSwitcherEnhancer />
        <ContextSwitcherEnhancer />
      </>,
    );
    const trigger = document.querySelector("[data-ctx-trigger]") as HTMLElement;
    fireEvent.click(trigger);
    await flush();
    // A double-bound click handler would toggle twice and land back on closed.
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
