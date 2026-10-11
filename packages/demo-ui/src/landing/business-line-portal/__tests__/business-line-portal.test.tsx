import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByRole, queryAllByRole } from "../../../test-utils/zudo-react";
import { getHeading, queryHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { BusinessLinePortal } from "../business-line-portal";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

const LINES = [
  { key: "vacuum", label: "Vacuum Systems", description: "Desc one.", href: "/lines/vacuum" },
  { key: "laser", label: "Laser Solutions", description: "Desc two.", href: "/lines/laser" },
];

describe("BusinessLinePortal", () => {
  it("renders every line by default", () => {
    const { container } = render(<BusinessLinePortal heading="Our lines" lines={LINES} />);
    expect(getHeading(container, "Our lines")).toBeInTheDocument();
    expect(getByRole(container, "link", { name: /Vacuum Systems/ })).toHaveAttribute("href", "/lines/vacuum");
    expect(getByRole(container, "link", { name: /Laser Solutions/ })).toBeInTheDocument();
  });

  it("filters to the given keys when `only` is set", () => {
    const { container } = render(<BusinessLinePortal heading="Featured" lines={LINES} only={["laser"]} />);
    expect(queryAllByRole(container, "link", { name: /Vacuum Systems/ })).toHaveLength(0);
    expect(getByRole(container, "link", { name: /Laser Solutions/ })).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    const { container } = render(<BusinessLinePortal heading="Our lines" lines={LINES} bare />);
    expect(queryHeading(container, "Our lines")).not.toBeInTheDocument();
  });
});
