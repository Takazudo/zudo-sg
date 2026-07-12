import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { CardGrid } from "../card-grid";

describe("CardGrid", () => {
  it("renders a <div> with its children", () => {
    render(
      <CardGrid>
        <span>Item</span>
      </CardGrid>,
    );
    const el = screen.getByText("Item").parentElement!;
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]");
  });

  it("merges an extra class", () => {
    render(
      <CardGrid class="extra-class">
        <span>Item</span>
      </CardGrid>,
    );
    expect(screen.getByText("Item").parentElement!.className).toContain("extra-class");
  });
});
