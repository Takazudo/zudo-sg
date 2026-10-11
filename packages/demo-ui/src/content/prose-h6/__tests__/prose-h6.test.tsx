import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseH6 } from "../prose-h6";

describe("ProseH6", () => {
  it("renders an h6 with the muted minor-heading styling", () => {
    const root = renderStatic(<ProseH6>Smallest</ProseH6>);
    const el = getByText(root, "Smallest");
    expect(el.tagName).toBe("H6");
    expect(el.classList.contains("text-muted")).toBe(true);
  });
});
