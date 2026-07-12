import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseH5 } from "../prose-h5";

describe("ProseH5", () => {
  it("renders an h5 with the muted minor-heading styling", () => {
    render(<ProseH5>Minor</ProseH5>);
    const el = screen.getByRole("heading", { level: 5 });
    expect(el).toHaveTextContent("Minor");
    expect(el.className).toContain("text-muted");
  });
});
