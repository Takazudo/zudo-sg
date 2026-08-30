import { render, screen } from "@testing-library/preact";
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
});
