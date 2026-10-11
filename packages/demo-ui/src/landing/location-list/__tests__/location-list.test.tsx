import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, queryByText } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { LocationList } from "../location-list";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("LocationList", () => {
  it("renders each group heading and its locations", () => {
    const { container } = render(
      <LocationList
        groups={[
          {
            heading: "Domestic",
            locations: [{ name: "Head office", postal: "000-0000", place: "Tokyo" }],
          },
          {
            heading: "Overseas",
            locations: [{ name: "Example America Inc.", place: "United States" }],
          },
        ]}
      />,
    );
    expect(getHeading(container, "Domestic")).toBeInTheDocument();
    expect(getByText(container, "Head office")).toBeInTheDocument();
    expect(getByText(container, "000-0000")).toBeInTheDocument();
    expect(getHeading(container, "Overseas")).toBeInTheDocument();
    expect(getByText(container, "Example America Inc.")).toBeInTheDocument();
  });

  it("omits the postal line when absent", () => {
    const { container } = render(
      <LocationList
        groups={[{ heading: "Overseas", locations: [{ name: "Example Inc.", place: "US" }] }]}
      />,
    );
    expect(queryByText(container, "000-0000")).not.toBeInTheDocument();
  });
});
