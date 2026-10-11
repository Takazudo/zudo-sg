import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { FeatureSplit } from "../feature-split";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("FeatureSplit", () => {
  it("renders the heading and both pillars", () => {
    const { container } = render(
      <FeatureSplit
        heading="Two strengths, one company"
        pillars={[
          { index: "01", title: "Electronics", body: "First pillar body." },
          { index: "02", title: "Chemicals", body: "Second pillar body." },
        ]}
      />,
    );
    expect(getHeading(container, "Two strengths, one company")).toBeInTheDocument();
    expect(getByText(container, "Electronics")).toBeInTheDocument();
    expect(getByText(container, "Chemicals")).toBeInTheDocument();
    expect(getByText(container, "First pillar body.")).toBeInTheDocument();
  });
});
