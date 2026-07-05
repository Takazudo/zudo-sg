import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Card, CardBody, CardFooter, CardTitle } from "../card";

describe("Card", () => {
  it("renders a <div> by default", () => {
    render(<Card>Content</Card>);
    const el = screen.getByText("Content");
    expect(el.tagName).toBe("DIV");
  });

  it("renders an <a> when href is provided", () => {
    render(<Card href="/docs">Content</Card>);
    const el = screen.getByRole("link");
    expect(el.tagName).toBe("A");
    expect(el).toHaveAttribute("href", "/docs");
  });

  it("defaults to the outlined variant", () => {
    render(<Card>Content</Card>);
    const el = screen.getByText("Content");
    expect(el.className).toContain("border-line");
  });

  it("maps the elevated variant to a shadow class", () => {
    render(<Card variant="elevated">Content</Card>);
    expect(screen.getByText("Content").className).toContain("shadow-card");
  });

  it("maps the filled variant to a sunken surface class", () => {
    render(<Card variant="filled">Content</Card>);
    expect(screen.getByText("Content").className).toContain("bg-surface-sunken");
  });

  it("adds interactive classes only when href is set", () => {
    render(<Card>Static</Card>);
    expect(screen.getByText("Static").className).not.toContain("cursor-pointer");

    render(<Card href="/x">Linked</Card>);
    expect(screen.getByRole("link").className).toContain("cursor-pointer");
  });

  it("merges a caller-supplied class", () => {
    render(<Card class="custom-x">Content</Card>);
    expect(screen.getByText("Content").className).toContain("custom-x");
  });
});

describe("CardTitle", () => {
  it("renders an <h3>", () => {
    render(<CardTitle>My Title</CardTitle>);
    const el = screen.getByText("My Title");
    expect(el.tagName).toBe("H3");
  });
});

describe("CardBody", () => {
  it("renders a <p>", () => {
    render(<CardBody>Body copy</CardBody>);
    const el = screen.getByText("Body copy");
    expect(el.tagName).toBe("P");
  });
});

describe("CardFooter", () => {
  it("renders its children with a top border class", () => {
    render(<CardFooter>Actions</CardFooter>);
    const el = screen.getByText("Actions");
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("border-t");
  });
});
