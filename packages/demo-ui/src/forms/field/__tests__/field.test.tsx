import { renderIsland, getByRole, getByText } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { Field } from "../field";
import { Input } from "../../input/input";

describe("Field", () => {
  it("wires the label to the control via for/id", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Field id="sg-name" label="Name">{({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} name="name" />
        )}</Field>
      );
    }, {});
    // The label's accessible name also picks up the adjacent Required/Optional
    // badge text (no separating whitespace in the markup), so this matches by
    // substring rather than the exact "Name".
    const input = getByRole(container, "textbox", { name: /^Name/ });
    expect(input).toHaveAttribute("id", "sg-name");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(container.querySelector("label")).toHaveAttribute("for", "sg-name");
  });

  it("shows a Required badge when required", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Field id="sg-name" label="Name" required>{({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} name="name" />
        )}</Field>
      );
    }, {});
    expect(getByText(container, "Required")).toBeInTheDocument();
  });

  it("shows an Optional badge by default", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Field id="sg-company" label="Company">{({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} name="company" />
        )}</Field>
      );
    }, {});
    expect(getByText(container, "Optional")).toBeInTheDocument();
  });

  it("passes aria-describedby onto the control when a hint is set", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Field id="sg-email" label="Email" hint="Used to reply to your inquiry.">{({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} name="email" />
        )}</Field>
      );
    }, {});
    const input = getByRole(container, "textbox", { name: /^Email/ });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBe("sg-email-hint");
    expect(container.querySelector(`#${describedBy}`)).toHaveTextContent(
      "Used to reply to your inquiry.",
    );
  });
});
