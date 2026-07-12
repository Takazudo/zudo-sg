import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SubmitButton } from "../submit-button";

describe("SubmitButton", () => {
  it("defaults to type=submit", () => {
    render(<SubmitButton>Send</SubmitButton>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
  });

  it("forwards an explicit type", () => {
    render(<SubmitButton type="button">Send</SubmitButton>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "button");
  });

  it("can be disabled", () => {
    render(<SubmitButton disabled>Send</SubmitButton>);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
