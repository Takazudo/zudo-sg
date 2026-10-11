import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseP } from "../prose-p";

describe("ProseP", () => {
  it("renders a plain paragraph", () => {
    const root = renderStatic(<ProseP>Body copy.</ProseP>);
    expect(getByText(root, "Body copy.").tagName).toBe("P");
  });
});
