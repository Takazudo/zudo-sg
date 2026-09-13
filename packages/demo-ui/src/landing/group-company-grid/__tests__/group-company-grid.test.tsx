import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { GroupCompanyGrid } from "../group-company-grid";

const COMPANIES = [
  { name: "Example Labs Inc.", business: "Contract analysis.", established: "Founded 2020", location: "Tokyo" },
  { name: "Example Logistics Co., Ltd.", business: "Logistics operations.", established: "Founded 2003" },
];

describe("GroupCompanyGrid", () => {
  it("renders each company with business and established/location", () => {
    render(<GroupCompanyGrid heading="Group companies" companies={COMPANIES} />);
    expect(screen.getByRole("heading", { name: "Group companies" })).toBeInTheDocument();
    expect(screen.getByText("Example Labs Inc.")).toBeInTheDocument();
    expect(screen.getByText("Founded 2020 · Tokyo")).toBeInTheDocument();
    expect(screen.getByText("Founded 2003")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    render(<GroupCompanyGrid heading="Group companies" companies={COMPANIES} bare />);
    expect(screen.queryByRole("heading", { name: "Group companies" })).not.toBeInTheDocument();
  });
});
