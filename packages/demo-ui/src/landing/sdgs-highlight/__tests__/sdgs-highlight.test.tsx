import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { SdgsHighlight } from "../sdgs-highlight";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("SdgsHighlight", () => {
  it("renders the heading, initiatives, and a view-all link", () => {
    const { container } = render(
      <SdgsHighlight
        heading="Sustainable future"
        initiatives={[{ title: "Green products", body: "Body one." }]}
        href="/sustainability/sdgs"
      />,
    );
    expect(getHeading(container, "Sustainable future")).toBeInTheDocument();
    expect(getByText(container, "Green products")).toBeInTheDocument();
    expect(getByRole(container, "link", { name: /sustainability initiatives/ })).toHaveAttribute(
      "href",
      "/sustainability/sdgs",
    );
  });
});
