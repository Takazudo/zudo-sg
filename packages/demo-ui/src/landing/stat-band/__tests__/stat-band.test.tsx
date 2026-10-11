import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import type { Child } from "@takazudo/zfb/zudo-react";
import { StatBand } from "../stat-band";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("StatBand", () => {
  it("renders each stat's value, unit, and label", () => {
    const { container } = render(
      <StatBand
        stats={[
          { value: "1953", unit: "founded", label: "Founding year" },
          { value: "4", label: "Business segments" },
        ]}
      />,
    );
    expect(getByText(container, "1953")).toBeInTheDocument();
    expect(getByText(container, "founded")).toBeInTheDocument();
    expect(getByText(container, "Founding year")).toBeInTheDocument();
    expect(getByText(container, "Business segments")).toBeInTheDocument();
  });

  it("names the region without putting aria-label on the <dl>", () => {
    const { container } = render(<StatBand stats={[{ value: "1", label: "Stat" }]} />);
    expect(container.querySelector('section[aria-label="Company summary"]')).toBeInTheDocument();
  });
});
