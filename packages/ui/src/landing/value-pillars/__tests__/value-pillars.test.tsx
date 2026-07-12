import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ValuePillars } from "../value-pillars";

describe("ValuePillars", () => {
  it("renders each pillar's numbered badge, title, and body", () => {
    render(
      <ValuePillars
        heading="Where we create value"
        pillars={[
          { title: "Trading network", body: "Body one." },
          { title: "Manufacturing know-how", body: "Body two." },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Where we create value" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Trading network")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    render(<ValuePillars heading="Where we create value" pillars={[{ title: "A", body: "B" }]} bare />);
    expect(screen.queryByRole("heading", { name: "Where we create value" })).not.toBeInTheDocument();
  });
});
