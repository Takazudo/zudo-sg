import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SecondaryButton } from "../secondary-button";

describe("SecondaryButton", () => {
  it("defaults to type=button", () => {
    render(<SecondaryButton>Back to edit</SecondaryButton>);
    expect(screen.getByRole("button", { name: "Back to edit" })).toHaveAttribute("type", "button");
  });

  it("forwards arbitrary data-* attributes (used as the enhancer's action hook)", () => {
    render(<SecondaryButton data-contact-action="edit">Back to edit</SecondaryButton>);
    expect(screen.getByRole("button", { name: "Back to edit" })).toHaveAttribute(
      "data-contact-action",
      "edit",
    );
  });
});
