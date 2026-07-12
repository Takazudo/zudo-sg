import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseH2 } from "../prose-h2";

describe("ProseH2", () => {
  it("renders an h2 with the section heading styling", () => {
    render(<ProseH2>Section</ProseH2>);
    const el = screen.getByRole("heading", { level: 2 });
    expect(el).toHaveTextContent("Section");
    expect(el.className).toContain("text-title");
    expect(el.className).toContain("border-b-border");
  });
});
