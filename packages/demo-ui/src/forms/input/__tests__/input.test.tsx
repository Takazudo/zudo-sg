import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Input } from "../input";

describe("Input", () => {
  it("renders a text input by default", () => {
    render(<Input name="name" aria-label="Name" />);
    const el = screen.getByRole("textbox", { name: "Name" });
    expect(el).toHaveAttribute("type", "text");
  });

  it("forwards the type prop", () => {
    render(<Input name="email" type="email" aria-label="Email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("type", "email");
  });
});
