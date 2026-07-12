import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Field } from "../field";
import { Input } from "../../input/input";

describe("Field", () => {
  it("wires the label to the control via htmlFor/id", () => {
    render(
      <Field id="sg-name" label="Name">
        <Input id="sg-name" name="name" />
      </Field>,
    );
    // The label's accessible name also picks up the adjacent Required/Optional
    // badge text (no separating whitespace in the markup), so this matches by
    // substring rather than the exact "Name".
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
  });

  it("shows a Required badge when required", () => {
    render(
      <Field id="sg-name" label="Name" required>
        <Input id="sg-name" name="name" />
      </Field>,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("shows an Optional badge by default", () => {
    render(
      <Field id="sg-company" label="Company">
        <Input id="sg-company" name="company" />
      </Field>,
    );
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("injects aria-describedby onto the control when a hint is set", () => {
    render(
      <Field id="sg-email" label="Email" hint="Used to reply to your inquiry.">
        <Input id="sg-email" name="email" />
      </Field>,
    );
    const input = screen.getByLabelText(/^Email/);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Used to reply to your inquiry.",
    );
  });
});
