import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseH4 } from "../prose-h4";

describe("ProseH4", () => {
  it("renders an h4 with body-sized bold styling", () => {
    const root = renderStatic(<ProseH4>Detail</ProseH4>);
    const el = getByText(root, "Detail");
    expect(el.tagName).toBe("H4");
    expect(el.classList.contains("text-small")).toBe(true);
    expect(el.classList.contains("font-semibold")).toBe(true);
  });
});
