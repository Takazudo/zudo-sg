import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseBlockquote } from "../prose-blockquote";

describe("ProseBlockquote", () => {
  it("renders its children", () => {
    render(<ProseBlockquote>Quoted text</ProseBlockquote>);
    expect(screen.getByText("Quoted text").tagName).toBe("BLOCKQUOTE");
  });

  it("applies the muted italic left-rule styling", () => {
    render(<ProseBlockquote>Quoted text</ProseBlockquote>);
    expect(screen.getByText("Quoted text").className).toContain("text-muted");
  });
});
