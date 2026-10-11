import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { SectionNav } from "../section-nav";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("SectionNav", () => {
  it("renders the heading and each link", () => {
    const { container } = render(
      <SectionNav
        heading="Explore the site"
        links={[{ title: "Company", sub: "Company", body: "Body.", href: "/company" }]}
      />,
    );
    expect(getHeading(container, "Explore the site")).toBeInTheDocument();
    const link = getByRole(container, "link", { name: /Company/ });
    expect(link).toHaveAttribute("href", "/company");
    expect(link).not.toHaveAttribute("target");
  });

  it("marks external links with target=_blank and an outbound affordance", () => {
    const { container } = render(
      <SectionNav
        heading="Menu"
        links={[
          {
            title: "Recruit",
            sub: "Recruit",
            body: "Separate domain.",
            href: "https://example.com/",
            external: true,
          },
        ]}
      />,
    );
    const link = getByRole(container, "link", { name: /Recruit/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(getByText(container, "Visit site")).toBeInTheDocument();
  });
});
