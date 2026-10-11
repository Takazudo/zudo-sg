import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { ProductCategoryGrid } from "../product-category-grid";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("ProductCategoryGrid", () => {
  it("renders each category as a link with its tagline and items", () => {
    const { container } = render(
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
    expect(getHeading(container, "Our products")).toBeInTheDocument();
    expect(getByRole(container, "link", { name: /Electronic devices/ })).toHaveAttribute(
      "href",
      "/products/electronic-devices",
    );
    expect(getByText(container, "Optical sensors")).toBeInTheDocument();
  });
});
