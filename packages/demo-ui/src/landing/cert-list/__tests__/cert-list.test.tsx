import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { getHeading, queryHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { CertList } from "../cert-list";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("CertList", () => {
  it("renders each cert's code badge, name, and scope", () => {
    const { container } = render(
      <CertList
        heading="Certifications"
        certs={[{ code: "ISO 9001", name: "Quality management system", scope: "Scope text." }]}
      />,
    );
    expect(getHeading(container, "Certifications")).toBeInTheDocument();
    expect(getByText(container, "ISO 9001")).toBeInTheDocument();
    expect(getHeading(container, "Quality management system")).toBeInTheDocument();
    expect(getByText(container, "Scope text.")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    const { container } = render(<CertList heading="Certifications" certs={[{ code: "A", name: "B", scope: "C" }]} bare />);
    expect(queryHeading(container, "Certifications")).not.toBeInTheDocument();
  });
});
