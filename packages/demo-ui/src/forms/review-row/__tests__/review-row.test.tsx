import { renderIsland } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { ReviewRow } from "../review-row";

describe("ReviewRow", () => {
  it("renders the label and a dd carrying the dynamic review attribute", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <dl>
          <ReviewRow label="Name" reviewAttr="data-contact-review" field="name" />
        </dl>
      );
    }, {});
    expect(container).toHaveTextContent("Name");
    const dd = container.querySelector("dd");
    expect(dd).toHaveAttribute("data-contact-review", "name");
  });

  it("adds whitespace-pre-wrap when multiline", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <dl>
          <ReviewRow label="Message" reviewAttr="data-contact-review" field="message" multiline />
        </dl>
      );
    }, {});
    expect(container.querySelector("dd")).toHaveClass("whitespace-pre-wrap");
  });
});
