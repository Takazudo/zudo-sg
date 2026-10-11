// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fire,
  getByRole,
  renderIsland,
  renderSsr,
} from "../../__tests__/helpers/zudo-react.js";
import CatalogFilter from "../catalog-filter.js";
import { ATTR_TILE_SIZE, LS_TILE_SIZE } from "../../catalog/tile-size.js";
function CatalogFixture() {
  return (
    <div>
      <CatalogFilter categories={["actions", "forms"]} total={2} />
      <div data-sg-catalog>
        <section data-sg-section data-category="actions">
          <div data-sg-tile>
            <div data-thumbnail>Thumbnail</div>
            <a
              href="/button"
              data-sg-card
              data-name="button"
              data-category="actions"
              data-keywords="press click"
            >
              Button
            </a>
          </div>
        </section>
        <section data-sg-section data-category="forms">
          <a
            href="/input"
            data-sg-card
            data-name="input"
            data-category="forms"
            data-keywords="text field"
          >
            Input
          </a>
        </section>
        <div data-sg-empty hidden>
          No matching components
        </div>
      </div>
    </div>
  );
}
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(ATTR_TILE_SIZE);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute(ATTR_TILE_SIZE);
});
describe("CatalogFilter", () => {
  it("keeps the SSR catalog, hydrates and filters whole tiles, fallback cards, categories and empty state", async () => {
    expect(renderSsr(<CatalogFixture />)).toContain("data-thumbnail");
    const app = renderIsland(CatalogFixture, {});
    await app.flush();
    const input =
      app.container.querySelector<HTMLInputElement>(".sg-search-input")!;
    const tile = app.container.querySelector("[data-sg-tile]")! as HTMLElement;
    const forms = app.container.querySelector(
      '[data-sg-section][data-category="forms"]',
    )! as HTMLElement;
    const empty = app.container.querySelector(
      "[data-sg-empty]",
    )! as HTMLElement;
    expect(app.container.textContent).toContain("2 components");
    input.value = "  PRESS  ";
    fire(input, "input");
    await app.flush();
    expect(tile.hidden).toBe(false);
    expect(forms.hidden).toBe(true);
    expect(empty.hidden).toBe(true);
    expect(app.container.textContent).toContain("1 of 2 shown");
    fire(getByRole(app.container, "button", { name: "forms" }), "click");
    await app.flush();
    expect(tile.hidden).toBe(true);
    expect(empty.hidden).toBe(false);
    fire(getByRole(app.container, "button", { name: "Clear search" }), "click");
    await app.flush();
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(forms.hidden).toBe(false);
    fire(getByRole(app.container, "button", { name: "forms" }), "click");
    await app.flush();
    expect(tile.hidden).toBe(false);
    expect(app.container.textContent).toContain("2 components");
    fire(getByRole(app.container, "button", { name: "actions" }), "click");
    await app.flush();
    fire(getByRole(app.container, "button", { name: "All" }), "click");
    await app.flush();
    expect(forms.hidden).toBe(false);
  });
  it("restores tile size without hydration drift and persists selection", async () => {
    document.documentElement.setAttribute(ATTR_TILE_SIZE, "large");
    const app = renderIsland(CatalogFixture, {});
    await app.flush();
    expect(
      getByRole(app.container, "button", { name: "Large" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    fire(getByRole(app.container, "button", { name: "Compact" }), "click");
    await app.flush();
    expect(document.documentElement.getAttribute(ATTR_TILE_SIZE)).toBe(
      "compact",
    );
    expect(localStorage.getItem(LS_TILE_SIZE)).toBe("compact");
  });
  it("focuses search with slash outside inputs and removes the shortcut on disposal", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const app = renderIsland(CatalogFixture, {});
    const input = app.container.querySelector("input")!;
    const focus = vi.spyOn(input, "focus");
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "/", cancelable: true }),
    );
    expect(focus).toHaveBeenCalledTimes(1);
    fire(input, "keydown", { key: "/" });
    expect(focus).toHaveBeenCalledTimes(1);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "/", ctrlKey: true }),
    );
    expect(focus).toHaveBeenCalledTimes(1);
    app.dispose();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
    expect(focus).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(
      1,
    );
    expect(
      remove.mock.calls.filter(([type]) => type === "keydown"),
    ).toHaveLength(1);
  });
});
