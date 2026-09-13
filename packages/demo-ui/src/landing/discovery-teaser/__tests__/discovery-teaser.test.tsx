import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { DiscoveryTeaser } from "../discovery-teaser";

const SCENES = [
  { title: "Cars", body: "Body one." },
  { title: "Schools", body: "Body two." },
];

describe("DiscoveryTeaser", () => {
  it("renders the heading, scenes, and a view-all link", () => {
    render(
      <DiscoveryTeaser heading="Everyday places" scenes={SCENES} href="/company/discovery" />,
    );
    expect(screen.getByRole("heading", { name: "Everyday places" })).toBeInTheDocument();
    expect(screen.getByText("Cars")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See all scenes/ })).toHaveAttribute(
      "href",
      "/company/discovery",
    );
  });

  it("uses a custom link label when provided", () => {
    render(
      <DiscoveryTeaser
        heading="Everyday places"
        scenes={SCENES}
        href="/company/discovery"
        linkLabel="Explore more"
      />,
    );
    expect(screen.getByRole("link", { name: /Explore more/ })).toBeInTheDocument();
  });
});
