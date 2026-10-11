import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseH2 } from "../prose-h2";

describe("ProseH2", () => {
  it("renders an h2 with the section heading styling", () => {
    const root = renderStatic(<ProseH2>Section</ProseH2>);
    const el = getByText(root, "Section");
    expect(el.tagName).toBe("H2");
    expect(el.classList.contains("text-title")).toBe(true);
    expect(el.classList.contains("border-b-border")).toBe(true);
  });
});
