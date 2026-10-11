import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { BusinessSegments } from "../business-segments";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("BusinessSegments", () => {
  it("renders the heading and each segment as a link", () => {
    const { container } = render(
      <BusinessSegments
        heading="Our business segments"
        segments={[
          { title: "Electronics", body: "Body one.", href: "/products/electronics" },
          { title: "Chemicals", body: "Body two.", href: "/products/chemicals" },
        ]}
      />,
    );
    expect(getHeading(container, "Our business segments")).toBeInTheDocument();
    expect(getByRole(container, "link", { name: /Electronics/ })).toHaveAttribute(
      "href",
      "/products/electronics",
    );
    expect(getByText(container, "Body two.")).toBeInTheDocument();
  });
});
