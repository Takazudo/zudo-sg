import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { CompanyProfileTable } from "../company-profile-table";

describe("CompanyProfileTable", () => {
  it("renders each row's label and value", () => {
    render(
      <CompanyProfileTable
        rows={[
          { label: "Company name", value: "Example Co., Ltd." },
          { label: "Founded", value: "1953" },
        ]}
      />,
    );
    expect(screen.getByText("Company name")).toBeInTheDocument();
    expect(screen.getByText("Example Co., Ltd.")).toBeInTheDocument();
    expect(screen.getByText("Founded")).toBeInTheDocument();
    expect(screen.getByText("1953")).toBeInTheDocument();
  });

  it("names the region without putting aria-label on the <dl>", () => {
    render(<CompanyProfileTable rows={[{ label: "A", value: "B" }]} />);
    expect(screen.getByRole("region", { name: "Company profile" })).toBeInTheDocument();
  });
});
