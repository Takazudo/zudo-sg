import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseLi } from "../prose-li";

describe("ProseLi", () => {
  it("renders an li with the muted-marker styling", () => {
    const root = renderStatic(
      <ul>
        <ProseLi>Item one</ProseLi>
      </ul>,
    );
    const el = getByText(root, "Item one");
    expect(el.tagName).toBe("LI");
    expect(el.classList.contains("marker:text-muted")).toBe(true);
    expect(el.classList.contains("zc-prose-li")).toBe(true);
  });
});
