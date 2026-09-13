import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseH6 } from "../prose-h6";

describe("ProseH6", () => {
  it("renders an h6 with the muted minor-heading styling", () => {
    render(<ProseH6>Smallest</ProseH6>);
    const el = screen.getByRole("heading", { level: 6 });
    expect(el).toHaveTextContent("Smallest");
    expect(el.className).toContain("text-muted");
  });
});
