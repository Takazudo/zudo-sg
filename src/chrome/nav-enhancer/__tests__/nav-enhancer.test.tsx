import { fireEvent, render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SiteNav, type NavSection } from "../../site-nav/site-nav";
import NavEnhancer from "../nav-enhancer";

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [{ label: "About", href: "/company/about", slug: "company/about", order: 1 }],
  },
  {
    label: "Products",
    order: 2,
    children: [{ label: "Widgets", href: "/products/widgets", slug: "products/widgets", order: 1 }],
  },
];

/** Renders the real SiteNav SSR markup plus the enhancer, as a consumer would. */
function setup() {
  render(
    <>
      <SiteNav sections={SECTIONS} />
      <NavEnhancer />
    </>,
  );
  const item = document.querySelector('[data-section="Company"]') as HTMLDetailsElement;
  const trigger = item.querySelector("[data-nav-trigger]") as HTMLElement;
  return { item, trigger };
}

describe("NavEnhancer", () => {
  it("syncs aria-expanded to true when a section opens", () => {
    const { item, trigger } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(item.open).toBe(true);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("syncs aria-expanded back to false when a section closes", () => {
    const { item, trigger } = setup();
    fireEvent.click(trigger); // open
    fireEvent.click(trigger); // close
    expect(item.open).toBe(false);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the focused section on Escape and returns focus to its summary", () => {
    const { item, trigger } = setup();
    fireEvent.click(trigger); // open
    trigger.focus();
    // The listener is on the <nav> root, so the keydown must be dispatched
    // on (or bubble up through) an element inside it, not on `document`.
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(item.open).toBe(false);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("ignores Escape when focus is outside every open section", () => {
    const { item, trigger } = setup();
    fireEvent.click(trigger); // open Company
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(item, { key: "Escape" });
    // Nothing had focus inside the open section, so it stays open.
    expect(item.open).toBe(true);
  });

  it("syncs aria-expanded for a section that starts open via currentSlug", () => {
    render(
      <>
        <SiteNav sections={SECTIONS} currentSlug="company/about" />
        <NavEnhancer />
      </>,
    );
    const item = document.querySelector('[data-section="Company"]') as HTMLDetailsElement;
    const trigger = item.querySelector("[data-nav-trigger]") as HTMLElement;
    expect(item.open).toBe(true);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
