import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { StrengthList } from "../strength-list";

describe("StrengthList", () => {
  it("renders each strength's number, title, and body", () => {
    render(
      <StrengthList
        heading="Our strengths"
        strengths={[
          { no: "01", title: "Broad supplier network", body: "Body one." },
          { no: "02", title: "In-house manufacturing", body: "Body two." },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Our strengths" })).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Broad supplier network" })).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    render(<StrengthList heading="Our strengths" strengths={[{ no: "01", title: "A", body: "B" }]} bare />);
    expect(screen.queryByRole("heading", { name: "Our strengths" })).not.toBeInTheDocument();
  });
});
