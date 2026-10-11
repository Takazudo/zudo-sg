import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseDl, ProseDt, ProseDd } from "../prose-dl";

describe("ProseDl / ProseDt / ProseDd", () => {
  it("renders a definition list with its terms and descriptions", () => {
    const root = renderStatic(
      <ProseDl>
        <ProseDt>hsp</ProseDt>
        <ProseDd>Horizontal spacing axis.</ProseDd>
      </ProseDl>,
    );
    expect(getByText(root, "hsp").tagName).toBe("DT");
    expect(getByText(root, "Horizontal spacing axis.").tagName).toBe("DD");
  });

  it("applies bold to dt and muted to dd", () => {
    const root = renderStatic(
      <ProseDl>
        <ProseDt>hsp</ProseDt>
        <ProseDd>Horizontal spacing axis.</ProseDd>
      </ProseDl>,
    );
    expect(getByText(root, "hsp").classList.contains("font-semibold")).toBe(true);
    expect(getByText(root, "Horizontal spacing axis.").classList.contains("text-muted")).toBe(true);
  });
});
