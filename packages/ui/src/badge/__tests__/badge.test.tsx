import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Badge } from "../badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("defaults to neutral soft", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toContain("bg-surface-sunken");
    expect(el.className).toContain("text-ink-soft");
  });

  it("maps tone + variant to the right class set", () => {
    render(
      <Badge tone="brand" variant="solid">
        New
      </Badge>,
    );
    const el = screen.getByText("New");
    expect(el.className).toContain("bg-brand");
    expect(el.className).toContain("text-on-brand");
  });

  it("renders the outline variant with a border class", () => {
    render(
      <Badge tone="danger" variant="outline">
        Error
      </Badge>,
    );
    const el = screen.getByText("Error");
    expect(el.className).toContain("border-danger");
    expect(el.className).toContain("text-danger");
  });
});
