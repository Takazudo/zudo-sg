import { renderIsland, getByText } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { Card } from "../card";

describe("Card", () => {
  it("renders its children", () => {
    const { container } = renderIsland(function Fixture() {
      return <Card>Content</Card>;
    }, {});
    expect(getByText(container, "Content")).toBeInTheDocument();
  });

  it("renders the title prop through Card.Title", () => {
    const { container } = renderIsland(function Fixture() {
      return <Card title="Heading">Content</Card>;
    }, {});
    const heading = container.querySelector("h3");
    expect(heading).toHaveTextContent("Heading");
  });

  it("defaults to the default variant", () => {
    const { container } = renderIsland(function Fixture() {
      return <Card>Content</Card>;
    }, {});
    expect(getByText(container, "Content").parentElement!.classList.contains("bg-bg")).toBe(true);
  });

  it("maps the accent variant to a top accent rule", () => {
    const { container } = renderIsland(function Fixture() {
      return <Card variant="accent">Content</Card>;
    }, {});
    expect(getByText(container, "Content").parentElement!.classList.contains("border-t-accent")).toBe(true);
  });

  it("maps the muted variant to the surface tint", () => {
    const { container } = renderIsland(function Fixture() {
      return <Card variant="muted">Content</Card>;
    }, {});
    expect(getByText(container, "Content").parentElement!.classList.contains("bg-surface")).toBe(true);
  });

  it("exposes Card.Title as a standalone export", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Card>
          <Card.Title>Explicit title</Card.Title>
        </Card>
      );
    }, {});
    expect(container.querySelector("h3")).toHaveTextContent("Explicit title");
  });
});
