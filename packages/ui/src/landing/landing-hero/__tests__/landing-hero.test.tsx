import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { LandingHero } from "../landing-hero";

describe("LandingHero", () => {
  it("renders the heading, lead, and actions", () => {
    render(
      <LandingHero
        eyebrow="Sample Tagline"
        heading="Two industries, one company"
        lead="A demo positioning statement."
        actions={[{ label: "View products", href: "/products", variant: "primary" }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Two industries, one company" })).toBeInTheDocument();
    expect(screen.getByText("A demo positioning statement.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View products" })).toHaveAttribute("href", "/products");
  });
});
