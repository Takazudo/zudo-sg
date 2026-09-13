import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { LocationList } from "../location-list";

describe("LocationList", () => {
  it("renders each group heading and its locations", () => {
    render(
      <LocationList
        groups={[
          {
            heading: "Domestic",
            locations: [{ name: "Head office", postal: "000-0000", place: "Tokyo" }],
          },
          {
            heading: "Overseas",
            locations: [{ name: "Example America Inc.", place: "United States" }],
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Domestic" })).toBeInTheDocument();
    expect(screen.getByText("Head office")).toBeInTheDocument();
    expect(screen.getByText("000-0000")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overseas" })).toBeInTheDocument();
    expect(screen.getByText("Example America Inc.")).toBeInTheDocument();
  });

  it("omits the postal line when absent", () => {
    render(
      <LocationList
        groups={[{ heading: "Overseas", locations: [{ name: "Example Inc.", place: "US" }] }]}
      />,
    );
    expect(screen.queryByText("000-0000")).not.toBeInTheDocument();
  });
});
