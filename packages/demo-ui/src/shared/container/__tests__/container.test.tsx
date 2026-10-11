import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { Container } from "../container";

afterEach(disposeAll);

describe("Container", () => {
  it("renders a <div> with its children by default", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Container>
          <span>Content</span>
        </Container>
      );
    }, {});
    const el = getByText(container, "Content").parentElement!;
    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("max-w-[88rem]")).toBe(true);
  });

  it("renders the given `as` tag", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Container as="section">
          <span>Content</span>
        </Container>
      );
    }, {});
    expect(getByText(container, "Content").parentElement!.tagName).toBe("SECTION");
  });

  it("centers via inline margin-inline:auto", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Container>
          <span>Content</span>
        </Container>
      );
    }, {});
    const el = getByText(container, "Content").parentElement as HTMLElement;
    expect(el.style.getPropertyValue("margin-inline")).toBe("auto");
  });
});
