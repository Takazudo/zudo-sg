import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SectionNav } from "../section-nav";

describe("SectionNav", () => {
  it("renders the heading and each link", () => {
    render(
      <SectionNav
        heading="Explore the site"
        links={[{ title: "Company", sub: "Company", body: "Body.", href: "/company" }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Explore the site" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Company/ });
    expect(link).toHaveAttribute("href", "/company");
    expect(link).not.toHaveAttribute("target");
  });

  it("marks external links with target=_blank and an outbound affordance", () => {
    render(
      <SectionNav
        heading="Menu"
        links={[
          {
            title: "Recruit",
            sub: "Recruit",
            body: "Separate domain.",
            href: "https://example.com/",
            external: true,
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: /Recruit/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Visit site")).toBeInTheDocument();
  });
});
