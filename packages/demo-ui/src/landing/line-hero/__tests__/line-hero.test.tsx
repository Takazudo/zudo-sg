import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, queryAllByRole } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { LineHero } from "../line-hero";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("LineHero", () => {
  it("renders the eyebrow, heading, lead, and actions", () => {
    const { container } = render(
      <LineHero
        eyebrow="Vacuum Solutions"
        heading="Reliable vacuum equipment"
        lead="A demo lead paragraph."
        actions={[{ label: "View lineup", href: "/lines/vacuum/products", variant: "primary" }]}
      />,
    );
    expect(getByText(container, "Vacuum Solutions")).toBeInTheDocument();
    expect(getHeading(container, "Reliable vacuum equipment")).toBeInTheDocument();
    expect(container.querySelector('a[href="/lines/vacuum/products"]')).toBeInTheDocument();
  });

  it("renders with no actions", () => {
    const { container } = render(<LineHero heading="Minimal hero" />);
    expect(getHeading(container, "Minimal hero")).toBeInTheDocument();
    expect(queryAllByRole(container, "link")).toHaveLength(0);
  });
});
