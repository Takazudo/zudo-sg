import { renderIsland, getByRole, getByText, queryByText } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { Callout, Note } from "../callout";

describe("Callout", () => {
  it("renders its children with role=note", () => {
    const { container } = renderIsland(function Fixture() {
      return <Callout>Content</Callout>;
    }, {});
    expect(getByRole(container, "note")).toHaveTextContent("Content");
  });

  it("renders the title when provided", () => {
    const { container } = renderIsland(function Fixture() {
      return <Callout title="Heads up">Content</Callout>;
    }, {});
    expect(getByText(container, "Heads up")).toBeInTheDocument();
  });

  it("omits the title row when not provided", () => {
    const { container } = renderIsland(function Fixture() {
      return <Callout>Content</Callout>;
    }, {});
    expect(queryByText(container, "Heads up")).not.toBeInTheDocument();
  });

  it("defaults to the note tone", () => {
    const { container } = renderIsland(function Fixture() {
      return <Callout title="Heads up">Content</Callout>;
    }, {});
    expect(getByText(container, "Heads up").classList.contains("text-accent")).toBe(true);
  });

  it("applies the muted tone's title class", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Callout tone="muted" title="Heads up">
          Content
        </Callout>
      );
    }, {});
    expect(getByText(container, "Heads up").classList.contains("text-fg")).toBe(true);
  });
});

describe("Note", () => {
  it("is a tone=note alias of Callout", () => {
    const { container } = renderIsland(function Fixture() {
      return <Note title="Heads up">Content</Note>;
    }, {});
    const note = getByRole(container, "note");
    expect(note).toHaveTextContent("Content");
    expect(getByText(container, "Heads up").classList.contains("text-accent")).toBe(true);
  });
});
