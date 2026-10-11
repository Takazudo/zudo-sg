import { renderIsland, getByRole } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders a textarea with the default row count", () => {
    const { container } = renderIsland(function Fixture() {
      return <Textarea name="message" aria-label="Message" />;
    }, {});
    const el = getByRole(container, "textbox", { name: "Message" });
    expect(el.tagName).toBe("TEXTAREA");
    expect(el).toHaveAttribute("rows", "6");
  });

  it("forwards a custom rows value", () => {
    const { container } = renderIsland(function Fixture() {
      return <Textarea name="message" rows={3} aria-label="Message" />;
    }, {});
    expect(getByRole(container, "textbox", { name: "Message" })).toHaveAttribute("rows", "3");
  });
});
