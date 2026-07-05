import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "../footer";

const groups = [
  {
    heading: "Product",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Company",
    links: [{ label: "About", href: "/about" }],
  },
];

describe("SiteFooter", () => {
  it("renders the brand", () => {
    render(<SiteFooter brand="zudo-sg" />);
    expect(screen.getByText("zudo-sg")).toBeInTheDocument();
  });

  it("renders the tagline only when provided", () => {
    const { rerender } = render(<SiteFooter brand="x" tagline="A tagline." />);
    expect(screen.getByText("A tagline.")).toBeInTheDocument();

    rerender(<SiteFooter brand="x" />);
    expect(screen.queryByText("A tagline.")).not.toBeInTheDocument();
  });

  it("renders grouped nav links with headings and hrefs", () => {
    render(<SiteFooter brand="x" groups={groups} />);
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeInTheDocument();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  });

  it("omits the nav element when there are no groups", () => {
    render(<SiteFooter brand="x" />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders the copyright line only when provided", () => {
    const { rerender } = render(<SiteFooter brand="x" copyright="© 2026" />);
    expect(screen.getByText("© 2026")).toBeInTheDocument();

    rerender(<SiteFooter brand="x" />);
    expect(screen.queryByText("© 2026")).not.toBeInTheDocument();
  });

  it("merges a caller-supplied class onto the <footer>", () => {
    const { container } = render(<SiteFooter brand="x" class="custom-x" />);
    expect(container.querySelector("footer")?.className).toContain("custom-x");
  });
});
