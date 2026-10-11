import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { LandingHero } from "../landing-hero";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("LandingHero", () => {
  it("renders the heading, lead, and actions", () => {
    const { container } = render(
      <LandingHero
        eyebrow="Sample Tagline"
        heading="Two industries, one company"
        lead="A demo positioning statement."
        actions={[{ label: "View products", href: "/products", variant: "primary" }]}
      />,
    );
    expect(getHeading(container, "Two industries, one company")).toBeInTheDocument();
    expect(getByText(container, "A demo positioning statement.")).toBeInTheDocument();
    expect(container.querySelector('a[href="/products"]')).toBeInTheDocument();
  });
});
