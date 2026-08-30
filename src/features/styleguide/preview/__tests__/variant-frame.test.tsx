import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import VariantFrame from "../variant-frame";

describe("VariantFrame", () => {
  it("keeps the exact sandbox token set required by form stories", () => {
    render(
      <VariantFrame
        slug="contact-form"
        exportName="Default"
        name="Contact form"
      />,
    );

    const iframe = screen.getByTitle("contact-form — Contact form");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms",
    );
  });

  it("offers an honest non-shrinking desktop viewport in a focusable scroller", () => {
    render(
      <VariantFrame
        slug="cta-button"
        exportName="Playground"
        name="CTA button"
      />,
    );

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Mobile", "Tablet", "Desktop", "Full"]);

    const scroller = screen.getByRole("region", {
      name: "Preview viewport canvas",
    });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller.className).toContain("overflow-x-auto");

    const frameWrapper = screen
      .getByTitle("cta-button — CTA button")
      .parentElement;
    expect(frameWrapper?.className).toContain("shrink-0");

    for (const [label, width] of [
      ["Mobile", "320px"],
      ["Tablet", "768px"],
      ["Desktop", "1280px"],
      ["Full", "100%"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(frameWrapper).toHaveStyle({ width });
    }
  });
});
