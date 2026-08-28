import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { HistoryTimeline } from "../history-timeline";

describe("HistoryTimeline", () => {
  it("renders each entry's year and event as a list item", () => {
    render(
      <HistoryTimeline
        entries={[
          { year: "1953", event: "Company founded." },
          { year: "2022", event: "Listed on the Prime Market." },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(screen.getByText("1953")).toBeInTheDocument();
    expect(screen.getByText("Company founded.")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
  });
});
