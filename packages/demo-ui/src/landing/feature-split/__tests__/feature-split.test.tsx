import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { FeatureSplit } from "../feature-split";

describe("FeatureSplit", () => {
  it("renders the heading and both pillars", () => {
    render(
      <FeatureSplit
        heading="Two strengths, one company"
        pillars={[
          { index: "01", title: "Electronics", body: "First pillar body." },
          { index: "02", title: "Chemicals", body: "Second pillar body." },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Two strengths, one company" })).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Chemicals")).toBeInTheDocument();
    expect(screen.getByText("First pillar body.")).toBeInTheDocument();
  });
});
