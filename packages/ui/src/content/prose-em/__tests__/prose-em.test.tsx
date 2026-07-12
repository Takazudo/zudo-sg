import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseEm } from "../prose-em";

describe("ProseEm", () => {
  it("renders an italic em element", () => {
    render(<ProseEm>emphasized</ProseEm>);
    const el = screen.getByText("emphasized");
    expect(el.tagName).toBe("EM");
    expect(el.className).toContain("italic");
  });
});
