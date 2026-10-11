import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseUl } from "../prose-ul";

describe("ProseUl", () => {
  it("renders a disc-marked list", () => {
    const root = renderStatic(
      <ProseUl>
        <li>Item one</li>
      </ProseUl>,
    );
    const el = getByText(root, "Item one").parentElement as HTMLElement;
    expect(el.tagName).toBe("UL");
    expect(el.classList.contains("list-disc")).toBe(true);
  });
});
