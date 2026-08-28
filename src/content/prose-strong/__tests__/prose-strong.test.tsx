import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseStrong } from "../prose-strong";

describe("ProseStrong", () => {
  it("renders a bold strong element", () => {
    render(<ProseStrong>important</ProseStrong>);
    const el = screen.getByText("important");
    expect(el.tagName).toBe("STRONG");
    expect(el.className).toContain("font-bold");
  });
});
