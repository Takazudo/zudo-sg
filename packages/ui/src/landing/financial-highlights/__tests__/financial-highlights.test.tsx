import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { FinancialHighlights } from "../financial-highlights";

describe("FinancialHighlights", () => {
  it("renders the pending label when a metric has no value", () => {
    render(
      <FinancialHighlights heading="Financial highlights" metrics={[{ label: "Net sales", unit: "million yen" }]} />,
    );
    expect(screen.getByText("Net sales")).toBeInTheDocument();
    expect(screen.getByText(/Updated at earnings release/)).toBeInTheDocument();
  });

  it("renders the value and unit when set", () => {
    render(
      <FinancialHighlights
        heading="Financial highlights"
        metrics={[{ label: "Net sales", unit: "million yen", value: "82,340" }]}
      />,
    );
    expect(screen.getByText("82,340")).toBeInTheDocument();
    expect(screen.getByText("million yen")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    render(
      <FinancialHighlights heading="Financial highlights" metrics={[{ label: "Net sales", unit: "million yen" }]} bare />,
    );
    expect(screen.queryByRole("heading", { name: "Financial highlights" })).not.toBeInTheDocument();
  });
});
