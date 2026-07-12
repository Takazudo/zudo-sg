import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { BusinessLinePortal } from "../business-line-portal";

const LINES = [
  { key: "vacuum", label: "Vacuum Systems", description: "Desc one.", href: "/lines/vacuum" },
  { key: "laser", label: "Laser Solutions", description: "Desc two.", href: "/lines/laser" },
];

describe("BusinessLinePortal", () => {
  it("renders every line by default", () => {
    render(<BusinessLinePortal heading="Our lines" lines={LINES} />);
    expect(screen.getByRole("heading", { name: "Our lines" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vacuum Systems/ })).toHaveAttribute("href", "/lines/vacuum");
    expect(screen.getByRole("link", { name: /Laser Solutions/ })).toBeInTheDocument();
  });

  it("filters to the given keys when `only` is set", () => {
    render(<BusinessLinePortal heading="Featured" lines={LINES} only={["laser"]} />);
    expect(screen.queryByRole("link", { name: /Vacuum Systems/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Laser Solutions/ })).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    render(<BusinessLinePortal heading="Our lines" lines={LINES} bare />);
    expect(screen.queryByRole("heading", { name: "Our lines" })).not.toBeInTheDocument();
  });
});
