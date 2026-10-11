import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseH5 } from "../prose-h5";

describe("ProseH5", () => {
  it("renders an h5 with the muted minor-heading styling", () => {
    const root = renderStatic(<ProseH5>Minor</ProseH5>);
    const el = getByText(root, "Minor");
    expect(el.tagName).toBe("H5");
    expect(el.classList.contains("text-muted")).toBe(true);
  });
});
