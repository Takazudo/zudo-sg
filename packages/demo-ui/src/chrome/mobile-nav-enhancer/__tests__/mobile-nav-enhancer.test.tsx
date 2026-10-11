import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fire, renderIsland } from "../../../test-utils/zudo-react.js";
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

function MobileNavFixture() {
  return (
    <>
      <SiteNav sections={SECTIONS} />
      <MobileNavEnhancer />
    </>
  );
}

/** Renders the real SiteNav SSR markup plus the enhancer, as a consumer would. */
function setup() {
  const app = renderIsland(MobileNavFixture, {});
  const toggle = app.container.querySelector("#zui-nav-toggle") as HTMLInputElement;
  const closeButton = app.container.querySelector("[data-nav-close]") as HTMLElement;
  return { app, toggle, closeButton };
}

function openDrawer(toggle: HTMLInputElement) {
  toggle.checked = true;
  fire(toggle, "change");
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

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    openDrawer(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Close menu");
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
    fire(toggle, "change");

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Open menu");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes and returns focus to the toggle on Escape", () => {
    const { toggle } = setup();
    openDrawer(toggle);
    fire(toggle, "keydown", { key: "Escape" });

    expect(toggle.checked).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("traps Tab: wraps from the last focusable element back to the first", () => {
    const { closeButton } = setup();
    const widgetsLink = document.querySelector('a[href="/products/widgets"]') as HTMLElement;
    openDrawer(document.getElementById("zui-nav-toggle") as HTMLInputElement);
    widgetsLink.focus();
    fire(widgetsLink, "keydown", { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("traps Shift+Tab: wraps from the first focusable element back to the last", () => {
    const { closeButton } = setup();
    const toggle = document.getElementById("zui-nav-toggle") as HTMLInputElement;
    openDrawer(toggle);
    closeButton.focus();
    fire(closeButton, "keydown", { key: "Tab", shiftKey: true });
    const widgetsLink = document.querySelector('a[href="/products/widgets"]') as HTMLElement;

    expect(document.activeElement).toBe(widgetsLink);
  });

  it("closes the drawer on resize back to the sm+ breakpoint", () => {
    const { toggle } = setup();
    openDrawer(toggle);
    window.innerWidth = 1024;
    window.dispatchEvent(new Event("resize"));

    expect(toggle.checked).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
  });

  it("does not touch an already-closed drawer on resize", () => {
    const { toggle } = setup();
    window.innerWidth = 1024;
    window.dispatchEvent(new Event("resize"));

    expect(toggle.checked).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Enter/Space from the close button and returns focus to the toggle", () => {
    const { toggle, closeButton } = setup();
    openDrawer(toggle);
    fire(closeButton, "keydown", { key: "Enter" });

    expect(toggle.checked).toBe(false);
    expect(document.activeElement).toBe(toggle);
  });

  it("releases the scroll lock on disposal even while left open", () => {
    const { app, toggle } = setup();
    openDrawer(toggle);
    expect(document.body.style.overflow).toBe("hidden");

    app.dispose();

    expect(document.body.style.overflow).toBe("");
    expect(app.container.isConnected).toBe(false);
  });
});
