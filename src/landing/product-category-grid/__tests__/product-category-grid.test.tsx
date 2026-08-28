import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProductCategoryGrid } from "../product-category-grid";

describe("ProductCategoryGrid", () => {
  it("renders each category as a link with its tagline and items", () => {
    render(
      <ProductCategoryGrid
        heading="Our products"
        categories={[
          {
            title: "Electronic devices",
            tagline: "Sensors and modules.",
            items: ["Optical sensors", "Image processing ICs"],
            href: "/products/electronic-devices",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Our products" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Electronic devices/ })).toHaveAttribute(
      "href",
      "/products/electronic-devices",
    );
    expect(screen.getByText("Optical sensors")).toBeInTheDocument();
  });
});
