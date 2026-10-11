import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { SplitLayout } from "../split-layout";

afterEach(disposeAll);

describe("SplitLayout", () => {
  it("renders left and right content", () => {
    const { container } = renderIsland(function Fixture() {
      return <SplitLayout left={<span>Left</span>} right={<span>Right</span>} />;
    }, {});
    expect(getByText(container, "Left")).toBeInTheDocument();
    expect(getByText(container, "Right")).toBeInTheDocument();
  });

  it("renders multiple ordered right-slot children in order", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <SplitLayout
          left={<span>Left</span>}
          right={
            <>
              <span>First</span>
              <span>Second</span>
            </>
          }
        />
      );
    }, {});
    const rightPane = getByText(container, "Left").parentElement!.nextElementSibling as HTMLElement;
    expect(rightPane.textContent).toBe("FirstSecond");
  });

  it("stacks in a column by default and switches to a row at md", () => {
    const { container } = renderIsland(function Fixture() {
      return <SplitLayout left={<span>Left</span>} right={<span>Right</span>} />;
    }, {});
    const root = getByText(container, "Left").parentElement!.parentElement!;
    expect(root.classList.contains("flex-col")).toBe(true);
    expect(root.classList.contains("md:flex-row")).toBe(true);
  });

  it("applies the ratio's flex-grow classes to left/right panes", () => {
    const { container } = renderIsland(function Fixture() {
      return <SplitLayout ratio="60/40" left={<span>Left</span>} right={<span>Right</span>} />;
    }, {});
    expect(getByText(container, "Left").parentElement!.classList.contains("zc-split-grow-3")).toBe(true);
    expect(getByText(container, "Right").parentElement!.classList.contains("zc-split-grow-2")).toBe(true);
  });

  it("defaults to an even 50/50 split", () => {
    const { container } = renderIsland(function Fixture() {
      return <SplitLayout left={<span>Left</span>} right={<span>Right</span>} />;
    }, {});
    expect(getByText(container, "Left").parentElement!.classList.contains("md:flex-1")).toBe(true);
    expect(getByText(container, "Right").parentElement!.classList.contains("md:flex-1")).toBe(true);
  });

  it("applies min-w-0 to both panes to prevent overflow", () => {
    const { container } = renderIsland(function Fixture() {
      return <SplitLayout left={<span>Left</span>} right={<span>Right</span>} />;
    }, {});
    expect(getByText(container, "Left").parentElement!.classList.contains("min-w-0")).toBe(true);
    expect(getByText(container, "Right").parentElement!.classList.contains("min-w-0")).toBe(true);
  });

  it("applies the gap classes for both axes", () => {
    const { container } = renderIsland(function Fixture() {
      return <SplitLayout gap="lg" left={<span>Left</span>} right={<span>Right</span>} />;
    }, {});
    const root = getByText(container, "Left").parentElement!.parentElement!;
    expect(root.classList.contains("gap-x-hsp-2xl")).toBe(true);
    expect(root.classList.contains("gap-y-vsp-xl")).toBe(true);
  });

  it("renders the given `as` tag", () => {
    const { container } = renderIsland(function Fixture() {
      return <SplitLayout as="section" left={<span>Left</span>} right={<span>Right</span>} />;
    }, {});
    expect(getByText(container, "Left").parentElement!.parentElement!.tagName).toBe("SECTION");
  });
});
