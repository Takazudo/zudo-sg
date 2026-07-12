import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Select } from "../select";

const OPTIONS = [
  { value: "product", label: "Product inquiry" },
  { value: "other", label: "Other" },
];

describe("Select", () => {
  it("renders every option", () => {
    render(<Select name="purpose" options={OPTIONS} aria-label="Purpose" />);
    const select = screen.getByRole("combobox", { name: "Purpose" });
    expect(screen.getByRole("option", { name: "Product inquiry" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Other" })).toBeInTheDocument();
    expect(select).toBeInTheDocument();
  });
});
