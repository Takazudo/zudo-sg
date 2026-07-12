import { fireEvent, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SiteNav, type NavSection } from "../../site-nav/site-nav";
import MobileNavEnhancer from "../mobile-nav-enhancer";

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

const ORIGINAL_INNER_WIDTH = window.innerWidth;

/** Renders the real SiteNav SSR markup plus the enhancer, as a consumer would. */
function setup() {
  render(
    <>
      <SiteNav sections={SECTIONS} />
      <MobileNavEnhancer />
    </>,
  );
  const toggle = document.getElementById("zui-nav-toggle") as HTMLInputElement;
  const closeButton = document.querySelector("[data-nav-close]") as HTMLElement;
  return { toggle, closeButton };
}

function openDrawer(toggle: HTMLInputElement) {
  toggle.checked = true;
  fireEvent.change(toggle);
}

describe("MobileNavEnhancer", () => {
  beforeEach(() => {
    window.innerWidth = ORIGINAL_INNER_WIDTH;
  });
  afterEach(() => {
    window.innerWidth = ORIGINAL_INNER_WIDTH;
    document.body.style.overflow = "";
  });

  it("syncs the toggle's aria-expanded/aria-label and locks scroll when opened", () => {
    const { toggle } = setup();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    openDrawer(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-label", "Close menu");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("moves focus into the drawer's first focusable element when opened", () => {
    const { toggle, closeButton } = setup();
    openDrawer(toggle);
    expect(document.activeElement).toBe(closeButton);
  });

  it("syncs back to closed and unlocks scroll when unchecked", () => {
    const { toggle } = setup();
    openDrawer(toggle);
    toggle.checked = false;
    fireEvent.change(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-label", "Open menu");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes and returns focus to the toggle on Escape", () => {
    const { toggle } = setup();
    openDrawer(toggle);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle.checked).toBe(false);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(toggle);
  });

  it("traps Tab: wraps from the last focusable element back to the first", () => {
    const { toggle, closeButton } = setup();
    openDrawer(toggle);
    const widgetsLink = document.querySelector('a[href="/products/widgets"]') as HTMLElement;
    widgetsLink.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  it("traps Shift+Tab: wraps from the first focusable element back to the last", () => {
    const { toggle, closeButton } = setup();
    openDrawer(toggle);
    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    const widgetsLink = document.querySelector('a[href="/products/widgets"]') as HTMLElement;
    expect(document.activeElement).toBe(widgetsLink);
  });

  it("closes the drawer on resize back to the sm+ breakpoint", () => {
    const { toggle } = setup();
    openDrawer(toggle);
    window.innerWidth = 1024;
    fireEvent(window, new Event("resize"));
    expect(toggle.checked).toBe(false);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("does not touch an already-closed drawer on resize", () => {
    const { toggle } = setup();
    window.innerWidth = 1024;
    fireEvent(window, new Event("resize"));
    expect(toggle.checked).toBe(false);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Enter/Space from the close button and returns focus to the toggle", () => {
    const { toggle, closeButton } = setup();
    openDrawer(toggle);
    fireEvent.keyDown(closeButton, { key: "Enter" });
    expect(toggle.checked).toBe(false);
    expect(document.activeElement).toBe(toggle);
  });

  it("releases the scroll lock on unmount even while left open", () => {
    const { unmount } = render(
      <>
        <SiteNav sections={SECTIONS} />
        <MobileNavEnhancer />
      </>,
    );
    const toggle = document.getElementById("zui-nav-toggle") as HTMLInputElement;
    openDrawer(toggle);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
