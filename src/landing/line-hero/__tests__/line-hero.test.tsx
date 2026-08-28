import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { LineHero } from "../line-hero";

describe("LineHero", () => {
  it("renders the eyebrow, heading, lead, and actions", () => {
    render(
      <LineHero
        eyebrow="Vacuum Solutions"
        heading="Reliable vacuum equipment"
        lead="A demo lead paragraph."
        actions={[{ label: "View lineup", href: "/lines/vacuum/products", variant: "primary" }]}
      />,
    );
    expect(screen.getByText("Vacuum Solutions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reliable vacuum equipment" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View lineup" })).toHaveAttribute(
      "href",
      "/lines/vacuum/products",
    );
  });

  it("renders with no actions", () => {
    render(<LineHero heading="Minimal hero" />);
    expect(screen.getByRole("heading", { name: "Minimal hero" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
