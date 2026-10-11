import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { AutoGrid } from "../auto-grid";

afterEach(disposeAll);

describe("AutoGrid", () => {
  it("renders a <div> with its children by default", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <AutoGrid>
          <span>Item</span>
        </AutoGrid>
      );
    }, {});
    const el = getByText(container, "Item").parentElement!;
    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]")).toBe(true);
  });

  it("switches to auto-fill columns when fill is set", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <AutoGrid min="13rem" fill>
          <span>Item</span>
        </AutoGrid>
      );
    }, {});
    const el = getByText(container, "Item").parentElement!;
    expect(el.classList.contains("grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]")).toBe(true);
  });

  it("renders as ul with list-none when as='ul'", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <AutoGrid as="ul">
          <li>Item</li>
        </AutoGrid>
      );
    }, {});
    const el = getByText(container, "Item").parentElement!;
    expect(el.tagName).toBe("UL");
    expect(el.classList.contains("list-none")).toBe(true);
  });
});
