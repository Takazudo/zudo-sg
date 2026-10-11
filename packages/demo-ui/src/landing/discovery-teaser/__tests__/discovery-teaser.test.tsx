import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { DiscoveryTeaser } from "../discovery-teaser";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

const SCENES = [
  { title: "Cars", body: "Body one." },
  { title: "Schools", body: "Body two." },
];

describe("DiscoveryTeaser", () => {
  it("renders the heading, scenes, and a view-all link", () => {
    const { container } = render(
      <DiscoveryTeaser heading="Everyday places" scenes={SCENES} href="/company/discovery" />,
    );
    expect(getHeading(container, "Everyday places")).toBeInTheDocument();
    expect(getByText(container, "Cars")).toBeInTheDocument();
    expect(getByRole(container, "link", { name: /See all scenes/ })).toHaveAttribute(
      "href",
      "/company/discovery",
    );
  });

  it("uses a custom link label when provided", () => {
    const { container } = render(
      <DiscoveryTeaser
        heading="Everyday places"
        scenes={SCENES}
        href="/company/discovery"
        linkLabel="Explore more"
      />,
    );
    expect(getByRole(container, "link", { name: /Explore more/ })).toBeInTheDocument();
  });
});
