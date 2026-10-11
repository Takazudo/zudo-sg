import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { getHeading, queryHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { ValuePillars } from "../value-pillars";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("ValuePillars", () => {
  it("renders each pillar's numbered badge, title, and body", () => {
    const { container } = render(
      <ValuePillars
        heading="Where we create value"
        pillars={[
          { title: "Trading network", body: "Body one." },
          { title: "Manufacturing know-how", body: "Body two." },
        ]}
      />,
    );
    expect(getHeading(container, "Where we create value")).toBeInTheDocument();
    expect(getByText(container, "1")).toBeInTheDocument();
    expect(getByText(container, "2")).toBeInTheDocument();
    expect(getByText(container, "Trading network")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    const { container } = render(<ValuePillars heading="Where we create value" pillars={[{ title: "A", body: "B" }]} bare />);
    expect(queryHeading(container, "Where we create value")).not.toBeInTheDocument();
  });
});
