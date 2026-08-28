import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseH3 } from "../prose-h3";

describe("ProseH3", () => {
  it("renders an h3 with the accent left-rule styling", () => {
    render(<ProseH3>Subsection</ProseH3>);
    const el = screen.getByRole("heading", { level: 3 });
    expect(el).toHaveTextContent("Subsection");
    expect(el.className).toContain("border-l-accent");
  });
});
