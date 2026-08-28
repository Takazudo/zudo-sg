import { fireEvent, render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import type { NavSection } from "../../site-nav/site-nav";
import { SiteHeader } from "../../site-header/site-header";
import ContextSwitcherEnhancer from "../context-switcher-enhancer";

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [{ label: "About", href: "/company/about", slug: "company/about", order: 1 }],
  },
];

// aria-expanded sync runs inside a queueMicrotask (see context-switcher-enhancer.tsx),
// so assertions on it must wait a tick for that microtask to flush.
const flush = () => Promise.resolve();

function setup() {
  render(
    <>
      <SiteHeader sections={SECTIONS} />
      <ContextSwitcherEnhancer />
    </>,
  );
  const trigger = document.querySelector("[data-ctx-trigger]") as HTMLElement;
  const panel = document.querySelector("[data-ctx-panel]") as HTMLElement;
  const destination = panel.querySelector('a[href="/company/about"]') as HTMLElement;
  return { trigger, panel, destination };
}

describe("ContextSwitcherEnhancer", () => {
  it("opens and pins the panel on click, syncing aria-expanded", async () => {
    const { trigger, panel } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(panel.style.visibility).toBe("visible"); // inline style applies synchronously
    expect(panel.style.translate).toBe("-50% 0");
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
    const { trigger, panel, destination } = setup();
    fireEvent.click(trigger); // open + pin
    await flush();
    destination.focus();
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
    const { trigger, panel, destination } = setup();
    fireEvent.click(trigger); // open + pin
    await flush();
    fireEvent.pointerDown(destination);
    expect(panel.style.visibility).toBe("visible");
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("clears the pinned state when focus leaves the disclosure entirely", async () => {
    const { trigger, panel, destination } = setup();
    fireEvent.click(trigger); // open + pin
    await flush();
    destination.focus();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus(); // real focus move — fires focusout on the destination with relatedTarget=outside
    // Cleared back to CSS-driven ("none"), not force-closed via inline styles.
    expect(panel.style.visibility).toBe("");
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("returns a force-closed panel to the CSS baseline when the pointer re-enters", async () => {
    const { trigger, panel } = setup();
    fireEvent.click(trigger); // open + pin
    fireEvent.click(trigger); // visibly open -> force closed
    expect(panel.style.visibility).toBe("hidden");

    fireEvent.pointerEnter(trigger.parentElement as HTMLElement);
    expect(panel.style.visibility).toBe("");
    await flush();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not double-bind when mounted twice (idempotency guard)", async () => {
    render(
      <>
        <SiteHeader sections={SECTIONS} />
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
