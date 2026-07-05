import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { PageHeading, SectionHeading } from "../heading";

describe("PageHeading", () => {
  it("renders an <h1> by default", () => {
    render(<PageHeading>Title</PageHeading>);
    const el = screen.getByRole("heading", { level: 1, name: "Title" });
    expect(el).toBeInTheDocument();
  });

  it("renders an <h2> when as='h2'", () => {
    render(<PageHeading as="h2">Title</PageHeading>);
    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toBeInTheDocument();
  });

  it("renders the eyebrow only when provided", () => {
    const { rerender } = render(<PageHeading eyebrow="Section">Title</PageHeading>);
    expect(screen.getByText("Section")).toBeInTheDocument();

    rerender(<PageHeading>Title</PageHeading>);
    expect(screen.queryByText("Section")).not.toBeInTheDocument();
  });

  it("renders the description only when provided", () => {
    const { rerender } = render(<PageHeading description="Supporting text.">Title</PageHeading>);
    expect(screen.getByText("Supporting text.")).toBeInTheDocument();

    rerender(<PageHeading>Title</PageHeading>);
    expect(screen.queryByText("Supporting text.")).not.toBeInTheDocument();
  });

  it("merges a caller-supplied class onto the wrapper", () => {
    const { container } = render(<PageHeading class="custom-x">Title</PageHeading>);
    expect(container.firstElementChild?.className).toContain("custom-x");
  });
});

describe("SectionHeading", () => {
  it("renders an <h2> by default", () => {
    render(<SectionHeading>Title</SectionHeading>);
    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toBeInTheDocument();
  });

  it("renders an <h3> when as='h3'", () => {
    render(<SectionHeading as="h3">Title</SectionHeading>);
    expect(screen.getByRole("heading", { level: 3, name: "Title" })).toBeInTheDocument();
  });

  it("renders the trailing action only when provided", () => {
    const { rerender } = render(
      <SectionHeading action={<a href="/all">View all</a>}>Title</SectionHeading>,
    );
    expect(screen.getByRole("link", { name: "View all" })).toBeInTheDocument();

    rerender(<SectionHeading>Title</SectionHeading>);
    expect(screen.queryByRole("link", { name: "View all" })).not.toBeInTheDocument();
  });

  it("renders the description only when provided", () => {
    const { rerender } = render(<SectionHeading description="Supporting text.">Title</SectionHeading>);
    expect(screen.getByText("Supporting text.")).toBeInTheDocument();

    rerender(<SectionHeading>Title</SectionHeading>);
    expect(screen.queryByText("Supporting text.")).not.toBeInTheDocument();
  });
});
