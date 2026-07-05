import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Hero } from "../hero";

describe("Hero", () => {
  it("renders the title as an <h1>", () => {
    render(<Hero title="Welcome" />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
  });

  it("renders the eyebrow, lede, and actions only when provided", () => {
    render(
      <Hero
        title="Welcome"
        eyebrow="New"
        lede="A supporting sentence."
        actions={<a href="/start">Start</a>}
      />,
    );
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("A supporting sentence.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start" })).toBeInTheDocument();
  });

  it("omits the eyebrow, lede, and actions when not provided", () => {
    render(<Hero title="Welcome" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("is tinted by default and drops the tint when tinted=false", () => {
    const { container, rerender } = render(<Hero title="Welcome" />);
    expect(container.querySelector("section")?.className).toContain("bg-brand-soft");

    rerender(<Hero title="Welcome" tinted={false} />);
    expect(container.querySelector("section")?.className).toContain("bg-surface");
    expect(container.querySelector("section")?.className).not.toContain("bg-brand-soft");
  });

  it("renders the media panel only when provided and adds the two-column grid class", () => {
    const { container, rerender } = render(<Hero title="Welcome" />);
    const inner = () => container.querySelector("section > div");
    expect(inner()?.className).not.toContain("lg:grid-cols-2");

    rerender(<Hero title="Welcome" media={<img src="/x.png" alt="Product screenshot" />} />);
    expect(screen.getByRole("img", { name: "Product screenshot" })).toBeInTheDocument();
    expect(inner()?.className).toContain("lg:grid-cols-2");
  });

  it("merges a caller-supplied class onto the <section>", () => {
    const { container } = render(<Hero title="Welcome" class="custom-x" />);
    expect(container.querySelector("section")?.className).toContain("custom-x");
  });
});
