import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { CategoryBadge } from "../category-badge";

describe("CategoryBadge", () => {
  it("renders the category label", () => {
    render(<CategoryBadge category="IR" />);
    expect(screen.getByText("IR")).toBeInTheDocument();
  });

  it("falls back to the neutral tone for an unregistered category", () => {
    render(<CategoryBadge category="Recruiting" />);
    const el = screen.getByText("Recruiting");
    expect(el).toHaveClass("text-muted");
  });

  it("uses the accent tone for a registered category", () => {
    render(<CategoryBadge category="IR" />);
    const el = screen.getByText("IR");
    expect(el).toHaveClass("text-accent");
  });
});
