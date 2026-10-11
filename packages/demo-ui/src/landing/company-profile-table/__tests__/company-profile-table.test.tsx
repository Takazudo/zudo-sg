import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import type { Child } from "@takazudo/zfb/zudo-react";
import { CompanyProfileTable } from "../company-profile-table";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("CompanyProfileTable", () => {
  it("renders each row's label and value", () => {
    const { container } = render(
      <CompanyProfileTable
        rows={[
          { label: "Company name", value: "Example Co., Ltd." },
          { label: "Founded", value: "1953" },
        ]}
      />,
    );
    expect(getByText(container, "Company name")).toBeInTheDocument();
    expect(getByText(container, "Example Co., Ltd.")).toBeInTheDocument();
    expect(getByText(container, "Founded")).toBeInTheDocument();
    expect(getByText(container, "1953")).toBeInTheDocument();
  });

  it("names the region without putting aria-label on the <dl>", () => {
    const { container } = render(<CompanyProfileTable rows={[{ label: "A", value: "B" }]} />);
    expect(container.querySelector('section[aria-label="Company profile"]')).toBeInTheDocument();
  });
});
