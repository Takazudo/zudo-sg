import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { getHeading, queryHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { StrengthList } from "../strength-list";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("StrengthList", () => {
  it("renders each strength's number, title, and body", () => {
    const { container } = render(
      <StrengthList
        heading="Our strengths"
        strengths={[
          { no: "01", title: "Broad supplier network", body: "Body one." },
          { no: "02", title: "In-house manufacturing", body: "Body two." },
        ]}
      />,
    );
    expect(getHeading(container, "Our strengths")).toBeInTheDocument();
    expect(getByText(container, "01")).toBeInTheDocument();
    expect(getHeading(container, "Broad supplier network")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    const { container } = render(<StrengthList heading="Our strengths" strengths={[{ no: "01", title: "A", body: "B" }]} bare />);
    expect(queryHeading(container, "Our strengths")).not.toBeInTheDocument();
  });
});
