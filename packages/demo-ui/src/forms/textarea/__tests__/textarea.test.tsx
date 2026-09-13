import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders a textarea with the default row count", () => {
    render(<Textarea name="message" aria-label="Message" />);
    const el = screen.getByRole("textbox", { name: "Message" });
    expect(el.tagName).toBe("TEXTAREA");
    expect(el).toHaveAttribute("rows", "6");
  });

  it("forwards a custom rows value", () => {
    render(<Textarea name="message" rows={3} aria-label="Message" />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute("rows", "3");
  });
});
