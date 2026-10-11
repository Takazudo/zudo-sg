import { renderIsland, getByText } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { CardGrid } from "../card-grid";

describe("CardGrid", () => {
  it("renders a <div> with its children", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <CardGrid>
          <span>Item</span>
        </CardGrid>
      );
    }, {});
    const el = getByText(container, "Item").parentElement!;
    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]")).toBe(true);
  });

  it("merges an extra class", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <CardGrid class="extra-class">
          <span>Item</span>
        </CardGrid>
      );
    }, {});
    expect(getByText(container, "Item").parentElement!.classList.contains("extra-class")).toBe(true);
  });
});
