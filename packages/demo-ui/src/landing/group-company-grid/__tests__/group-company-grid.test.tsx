import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { getHeading, queryHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { GroupCompanyGrid } from "../group-company-grid";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

const COMPANIES = [
  { name: "Example Labs Inc.", business: "Contract analysis.", established: "Founded 2020", location: "Tokyo" },
  { name: "Example Logistics Co., Ltd.", business: "Logistics operations.", established: "Founded 2003" },
];

describe("GroupCompanyGrid", () => {
  it("renders each company with business and established/location", () => {
    const { container } = render(<GroupCompanyGrid heading="Group companies" companies={COMPANIES} />);
    expect(getHeading(container, "Group companies")).toBeInTheDocument();
    expect(getByText(container, "Example Labs Inc.")).toBeInTheDocument();
    expect(getByText(container, "Founded 2020 · Tokyo")).toBeInTheDocument();
    expect(getByText(container, "Founded 2003")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    const { container } = render(<GroupCompanyGrid heading="Group companies" companies={COMPANIES} bare />);
    expect(queryHeading(container, "Group companies")).not.toBeInTheDocument();
  });
});
