import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseBlockquote } from "../prose-blockquote";

describe("ProseBlockquote", () => {
  it("renders its children", () => {
    const root = renderStatic(<ProseBlockquote>Quoted text</ProseBlockquote>);
    expect(getByText(root, "Quoted text").tagName).toBe("BLOCKQUOTE");
  });

  it("uses an authored class for paragraph spacing", () => {
    const root = renderStatic(
      <ProseBlockquote>
        <p>Quoted text</p>
      </ProseBlockquote>,
    );
    expect(root.querySelector("blockquote")?.classList.contains("zc-prose-blockquote")).toBe(true);
  });
});
