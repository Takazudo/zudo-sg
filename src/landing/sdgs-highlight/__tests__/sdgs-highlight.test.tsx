import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SdgsHighlight } from "../sdgs-highlight";

describe("SdgsHighlight", () => {
  it("renders the heading, initiatives, and a view-all link", () => {
    render(
      <SdgsHighlight
        heading="Sustainable future"
        initiatives={[{ title: "Green products", body: "Body one." }]}
        href="/sustainability/sdgs"
      />,
    );
    expect(screen.getByRole("heading", { name: "Sustainable future" })).toBeInTheDocument();
    expect(screen.getByText("Green products")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sustainability initiatives/ })).toHaveAttribute(
      "href",
      "/sustainability/sdgs",
    );
  });
});
