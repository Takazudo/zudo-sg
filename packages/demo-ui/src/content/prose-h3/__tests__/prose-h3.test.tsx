import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseH3 } from "../prose-h3";

describe("ProseH3", () => {
  it("renders an h3 with the accent left-rule styling", () => {
    const root = renderStatic(<ProseH3>Subsection</ProseH3>);
    const el = getByText(root, "Subsection");
    expect(el.tagName).toBe("H3");
    expect(el.classList.contains("border-l-accent")).toBe(true);
  });
});
