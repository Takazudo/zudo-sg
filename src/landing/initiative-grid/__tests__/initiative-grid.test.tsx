import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { InitiativeGrid } from "../initiative-grid";

describe("InitiativeGrid", () => {
  it("renders each initiative numbered, with title and body", () => {
    render(
      <InitiativeGrid
        heading="Our initiatives"
        initiatives={[
          { title: "Solar Farm A", body: "Body one." },
          { title: "Solar Farm B", body: "Body two." },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Our initiatives" })).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Solar Farm A" })).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    render(<InitiativeGrid heading="Our initiatives" initiatives={[{ title: "A", body: "B" }]} bare />);
    expect(screen.queryByRole("heading", { name: "Our initiatives" })).not.toBeInTheDocument();
  });
});
