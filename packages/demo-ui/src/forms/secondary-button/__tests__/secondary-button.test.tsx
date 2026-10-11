import { renderIsland, getByRole } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { SecondaryButton } from "../secondary-button";

describe("SecondaryButton", () => {
  it("defaults to type=button", () => {
    const { container } = renderIsland(function Fixture() {
      return <SecondaryButton>Back to edit</SecondaryButton>;
    }, {});
    expect(getByRole(container, "button", { name: "Back to edit" })).toHaveAttribute("type", "button");
  });

  it("forwards arbitrary data-* attributes (used as the enhancer's action hook)", () => {
    const { container } = renderIsland(function Fixture() {
      return <SecondaryButton data-contact-action="edit">Back to edit</SecondaryButton>;
    }, {});
    expect(getByRole(container, "button", { name: "Back to edit" })).toHaveAttribute(
      "data-contact-action",
      "edit",
    );
  });
});
