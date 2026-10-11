import { describe, expect, it } from "vitest";
import { fire, flushAll, renderIsland } from "../../../test-utils/zudo-react.js";
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

function ContextSwitcherFixture({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <>
      <SiteHeader sections={SECTIONS} />
      <ContextSwitcherEnhancer />
      {duplicate && <ContextSwitcherEnhancer />}
    </>
  );
}

function setup() {
  const app = renderIsland(ContextSwitcherFixture, {});
  const trigger = app.container.querySelector("[data-ctx-trigger]") as HTMLElement;
  const panel = app.container.querySelector("[data-ctx-panel]") as HTMLElement;
  const destination = panel.querySelector('a[href="/company/about"]') as HTMLElement;
  return { app, trigger, panel, destination };
}

describe("ContextSwitcherEnhancer", () => {
  it("opens and pins the panel on click, syncing aria-expanded", async () => {
    const { app, trigger, panel } = setup();
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fire(trigger, "click");
    expect(panel.style.visibility).toBe("visible");
    expect(panel.style.translate).toBe("-50% 0");
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on a second click", async () => {
    const { app, trigger, panel } = setup();
    fire(trigger, "click");
    fire(trigger, "click");

    expect(panel.style.visibility).toBe("hidden");
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and returns focus to the trigger when focus was inside", async () => {
    const { app, trigger, panel, destination } = setup();
    fire(trigger, "click");
    await app.flush();
    destination.focus();
    fire(destination, "keydown", { key: "Escape" });

    expect(panel.style.visibility).toBe("hidden");
    expect(document.activeElement).toBe(trigger);
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on an outside click", async () => {
    const { app, trigger, panel } = setup();
    fire(trigger, "click");
    await app.flush();
    const outside = document.createElement("button");
    document.body.appendChild(outside);

    fire(outside, "pointerdown");
    expect(panel.style.visibility).toBe("hidden");
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    outside.remove();
  });

  it("does not close on a click inside the panel", async () => {
    const { app, trigger, panel, destination } = setup();
    fire(trigger, "click");
    await app.flush();

    fire(destination, "pointerdown");
    expect(panel.style.visibility).toBe("visible");
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("tracks keyboard focus within the disclosure as open", async () => {
    const { app, trigger, destination } = setup();

    destination.focus();
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    outside.remove();
  });

  it("clears the pinned state when focus leaves the disclosure entirely", async () => {
    const { app, trigger, panel, destination } = setup();
    fire(trigger, "click");
    await app.flush();
    destination.focus();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    expect(panel.style.visibility).toBe("");
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    outside.remove();
  });

  it("returns a force-closed panel to the CSS baseline when the pointer re-enters", async () => {
    const { app, trigger, panel } = setup();
    fire(trigger, "click");
    fire(trigger, "click");
    expect(panel.style.visibility).toBe("hidden");

    fire(trigger.parentElement as HTMLElement, "pointerenter");
    expect(panel.style.visibility).toBe("");
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not double-bind when mounted twice (idempotency guard)", async () => {
    const app = renderIsland(ContextSwitcherFixture, { duplicate: true });
    const trigger = app.container.querySelector("[data-ctx-trigger]") as HTMLElement;

    fire(trigger, "click");
    await app.flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("removes interaction handlers when disposed", async () => {
    const { app, trigger, panel } = setup();
    fire(trigger, "click");
    await app.flush();
    app.dispose();
    expect(panel.style.visibility).toBe("");

    fire(trigger, "click");
    await flushAll();
    expect(panel.style.visibility).toBe("");
  });
});
