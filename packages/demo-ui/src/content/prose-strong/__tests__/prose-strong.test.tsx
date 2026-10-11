import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseStrong } from "../prose-strong";

describe("ProseStrong", () => {
  it("renders a bold strong element", () => {
    const root = renderStatic(<ProseStrong>important</ProseStrong>);
    const el = getByText(root, "important");
    expect(el.tagName).toBe("STRONG");
    expect(el.classList.contains("font-bold")).toBe(true);
  });
});
