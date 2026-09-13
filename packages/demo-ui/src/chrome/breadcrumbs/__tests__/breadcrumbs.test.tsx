import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "../breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders nothing for a single (home-only) crumb", () => {
    const { container } = render(<Breadcrumbs crumbs={[{ label: "Home", href: "/" }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders every crumb but the last as a link", () => {
    render(
      <Breadcrumbs
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Company", href: "/company" },
          { label: "Profile" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Company" })).toHaveAttribute("href", "/company");
  });

  it("renders the last crumb as non-link text with aria-current=page", () => {
    render(
      <Breadcrumbs
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Profile" },
        ]}
      />,
    );
    const current = screen.getByText("Profile");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders a middle crumb with no href as non-link text and no aria-current", () => {
    render(
      <Breadcrumbs
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Unlisted section" },
          { label: "Page" },
        ]}
      />,
    );
    const middle = screen.getByText("Unlisted section");
    expect(middle.tagName).toBe("SPAN");
    expect(middle).not.toHaveAttribute("aria-current");
  });
});
