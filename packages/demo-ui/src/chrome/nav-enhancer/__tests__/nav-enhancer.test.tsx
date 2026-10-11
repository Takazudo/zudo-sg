import { describe, expect, it } from "vitest";
import { fire, renderIsland } from "../../../test-utils/zudo-react.js";
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

function NavFixture({ current = false }: { current?: boolean }) {
  return (
    <>
      <SiteNav sections={SECTIONS} currentSlug={current ? "company/about" : undefined} />
      <NavEnhancer />
    </>
  );
}

/** Renders the real SiteNav SSR markup plus the enhancer, as a consumer would. */
function setup() {
  const app = renderIsland(NavFixture, {});
  const item = app.container.querySelector('[data-section="Company"]') as HTMLDetailsElement;
  const trigger = item.querySelector("[data-nav-trigger]") as HTMLElement;
  return { app, item, trigger };
}

describe("NavEnhancer", () => {
  it("syncs aria-expanded to true when a section opens", () => {
    const { item, trigger } = setup();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fire(trigger, "click");
    expect(item.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("syncs aria-expanded back to false when a section closes", () => {
    const { item, trigger } = setup();

    fire(trigger, "click");
    fire(trigger, "click");

    expect(item.open).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the focused section on Escape and returns focus to its summary", () => {
    const { item, trigger } = setup();

    fire(trigger, "click");
    trigger.focus();
    fire(trigger, "keydown", { key: "Escape" });

    expect(item.open).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("ignores Escape when focus is outside every open section", () => {
    const { item } = setup();
    fire(item.querySelector("[data-nav-trigger]") as HTMLElement, "click");
    (document.activeElement as HTMLElement | null)?.blur();
    fire(item, "keydown", { key: "Escape" });

    expect(item.open).toBe(true);
  });

  it("syncs aria-expanded for a section that starts open via currentSlug", () => {
    const app = renderIsland(NavFixture, { current: true });
    const item = app.container.querySelector('[data-section="Company"]') as HTMLDetailsElement;
    const trigger = item.querySelector("[data-nav-trigger]") as HTMLElement;

    expect(item.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("removes toggle and keyboard handlers on disposal", () => {
    const { app, item, trigger } = setup();
    app.dispose();
    item.open = true;
    fire(item, "toggle");
    fire(trigger, "keydown", { key: "Escape" });

    expect(item.open).toBe(true);
    expect(document.activeElement).not.toBe(trigger);
  });
});
