import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseH4 } from "../prose-h4";

describe("ProseH4", () => {
  it("renders an h4 with body-sized bold styling", () => {
    render(<ProseH4>Detail</ProseH4>);
    const el = screen.getByRole("heading", { level: 4 });
    expect(el).toHaveTextContent("Detail");
    expect(el.className).toContain("text-small");
    expect(el.className).toContain("font-semibold");
  });
});
