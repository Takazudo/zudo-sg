import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { getHeading, queryHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { InitiativeGrid } from "../initiative-grid";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("InitiativeGrid", () => {
  it("renders each initiative numbered, with title and body", () => {
    const { container } = render(
      <InitiativeGrid
        heading="Our initiatives"
        initiatives={[
          { title: "Solar Farm A", body: "Body one." },
          { title: "Solar Farm B", body: "Body two." },
        ]}
      />,
    );
    expect(getHeading(container, "Our initiatives")).toBeInTheDocument();
    expect(getByText(container, "01")).toBeInTheDocument();
    expect(getByText(container, "02")).toBeInTheDocument();
    expect(getHeading(container, "Solar Farm A")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    const { container } = render(<InitiativeGrid heading="Our initiatives" initiatives={[{ title: "A", body: "B" }]} bare />);
    expect(queryHeading(container, "Our initiatives")).not.toBeInTheDocument();
  });
});
