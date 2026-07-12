import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { StatBand } from "../stat-band";

describe("StatBand", () => {
  it("renders each stat's value, unit, and label", () => {
    render(
      <StatBand
        stats={[
          { value: "1953", unit: "founded", label: "Founding year" },
          { value: "4", label: "Business segments" },
        ]}
      />,
    );
    expect(screen.getByText("1953")).toBeInTheDocument();
    expect(screen.getByText("founded")).toBeInTheDocument();
    expect(screen.getByText("Founding year")).toBeInTheDocument();
    expect(screen.getByText("Business segments")).toBeInTheDocument();
  });

  it("names the region without putting aria-label on the <dl>", () => {
    render(<StatBand stats={[{ value: "1", label: "Stat" }]} />);
    expect(screen.getByRole("region", { name: "Company summary" })).toBeInTheDocument();
  });
});
