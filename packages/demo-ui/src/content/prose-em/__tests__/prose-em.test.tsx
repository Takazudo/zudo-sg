import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseEm } from "../prose-em";

describe("ProseEm", () => {
  it("renders an italic em element", () => {
    const root = renderStatic(<ProseEm>emphasized</ProseEm>);
    const el = getByText(root, "emphasized");
    expect(el.tagName).toBe("EM");
    expect(el.classList.contains("italic")).toBe(true);
  });
});
