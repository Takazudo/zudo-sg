import { renderIsland, getByRole } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { SubmitButton } from "../submit-button";

describe("SubmitButton", () => {
  it("defaults to type=submit", () => {
    const { container } = renderIsland(function Fixture() {
      return <SubmitButton>Send</SubmitButton>;
    }, {});
    expect(getByRole(container, "button", { name: "Send" })).toHaveAttribute("type", "submit");
  });

  it("forwards an explicit type", () => {
    const { container } = renderIsland(function Fixture() {
      return <SubmitButton type="button">Send</SubmitButton>;
    }, {});
    expect(getByRole(container, "button", { name: "Send" })).toHaveAttribute("type", "button");
  });

  it("can be disabled", () => {
    const { container } = renderIsland(function Fixture() {
      return <SubmitButton disabled>Send</SubmitButton>;
    }, {});
    expect(getByRole(container, "button", { name: "Send" })).toBeDisabled();
  });
});
