import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseDl, ProseDt, ProseDd } from "../prose-dl";

describe("ProseDl / ProseDt / ProseDd", () => {
  it("renders a definition list with its terms and descriptions", () => {
    render(
      <ProseDl>
        <ProseDt>hsp</ProseDt>
        <ProseDd>Horizontal spacing axis.</ProseDd>
      </ProseDl>,
    );
    expect(screen.getByText("hsp").tagName).toBe("DT");
    expect(screen.getByText("Horizontal spacing axis.").tagName).toBe("DD");
  });

  it("applies bold to dt and muted to dd", () => {
    render(
      <ProseDl>
        <ProseDt>hsp</ProseDt>
        <ProseDd>Horizontal spacing axis.</ProseDd>
      </ProseDl>,
    );
    expect(screen.getByText("hsp").className).toContain("font-semibold");
    expect(screen.getByText("Horizontal spacing axis.").className).toContain("text-muted");
  });
});
