import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseOl } from "../prose-ol";

describe("ProseOl", () => {
  it("renders a decimal-numbered list", () => {
    const root = renderStatic(
      <ProseOl start={3}>
        <li>Step one</li>
      </ProseOl>,
    );
    const el = root.querySelector("ol")!;
    expect(getByText(root, "Step one").parentElement).toBe(el);
    expect(el?.getAttribute("start")).toBe("3");
    expect(el.tagName).toBe("OL");
    expect(el.classList.contains("list-decimal")).toBe(true);
  });
});
