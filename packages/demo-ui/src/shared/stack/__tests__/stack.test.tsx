import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { Stack } from "../stack";

afterEach(disposeAll);

describe("Stack", () => {
  it("renders a <div> with its children, stacked vertically by default", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Stack>
          <span>First</span>
          <span>Second</span>
        </Stack>
      );
    }, {});
    const el = getByText(container, "First").parentElement!;
    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("flex-col")).toBe(true);
    expect(getByText(container, "Second")).toBeInTheDocument();
  });

  it("switches to a horizontal row that wraps (never forces overflow)", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Stack direction="horizontal">
          <span>A</span>
        </Stack>
      );
    }, {});
    const el = getByText(container, "A").parentElement!;
    expect(el.classList.contains("flex-row")).toBe(true);
    expect(el.classList.contains("flex-wrap")).toBe(true);
  });

  it("applies the vertical gap class by default", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Stack gap="lg">
          <span>Item</span>
        </Stack>
      );
    }, {});
    expect(getByText(container, "Item").parentElement!.classList.contains("gap-y-vsp-lg")).toBe(true);
  });

  it("applies the horizontal gap class when direction=horizontal", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Stack direction="horizontal" gap="lg">
          <span>Item</span>
        </Stack>
      );
    }, {});
    expect(getByText(container, "Item").parentElement!.classList.contains("gap-x-hsp-lg")).toBe(true);
  });

  it("applies align/justify classes", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Stack align="center" justify="between">
          <span>Item</span>
        </Stack>
      );
    }, {});
    const el = getByText(container, "Item").parentElement!;
    expect(el.classList.contains("items-center")).toBe(true);
    expect(el.classList.contains("justify-between")).toBe(true);
  });

  it("renders the given `as` tag", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Stack as="section">
          <span>Item</span>
        </Stack>
      );
    }, {});
    expect(getByText(container, "Item").parentElement!.tagName).toBe("SECTION");
  });
});
