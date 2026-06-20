import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Field, Input, Textarea } from "../form";

describe("Input", () => {
  it("defaults type to text", () => {
    render(<Input aria-label="name" />);
    expect(screen.getByLabelText("name")).toHaveAttribute("type", "text");
  });

  it("sets aria-invalid when invalid", () => {
    render(<Input aria-label="email" invalid />);
    expect(screen.getByLabelText("email")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Textarea", () => {
  it("renders with default rows and resize-y", () => {
    render(<Textarea aria-label="msg" />);
    const el = screen.getByLabelText("msg");
    expect(el.tagName).toBe("TEXTAREA");
    expect(el).toHaveAttribute("rows", "4");
    expect(el.className).toContain("resize-y");
  });
});

describe("Field", () => {
  it("associates the label with the control via for/id", () => {
    render(<Field label="Email">{(p) => <Input {...p} />}</Field>);
    // getByLabelText resolves the <label for> ↔ control id wiring.
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.id).toBeTruthy();
  });

  it("wires aria-describedby to the hint", () => {
    render(
      <Field label="Email" hint="We never share it.">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe("We never share it.");
  });

  it("prefers the error over the hint and marks it", () => {
    render(
      <Field label="Email" hint="ignored when error present" error="Required field.">
        {(p) => <Input {...p} />}
      </Field>,
    );
    expect(screen.getByText("Required field.")).toBeInTheDocument();
    expect(screen.queryByText("ignored when error present")).not.toBeInTheDocument();
  });

  it("shows a required marker", () => {
    render(<Field label="Email" required>{(p) => <Input {...p} />}</Field>);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("honors an explicit htmlFor id", () => {
    render(
      <Field label="Email" htmlFor="my-email">
        {(p) => <Input {...p} />}
      </Field>,
    );
    expect(screen.getByLabelText("Email").id).toBe("my-email");
  });
});
