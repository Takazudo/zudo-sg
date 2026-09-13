import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { BusinessSegments } from "../business-segments";

describe("BusinessSegments", () => {
  it("renders the heading and each segment as a link", () => {
    render(
      <BusinessSegments
        heading="Our business segments"
        segments={[
          { title: "Electronics", body: "Body one.", href: "/products/electronics" },
          { title: "Chemicals", body: "Body two.", href: "/products/chemicals" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Our business segments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Electronics/ })).toHaveAttribute(
      "href",
      "/products/electronics",
    );
    expect(screen.getByText("Body two.")).toBeInTheDocument();
  });
});
