import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import { queryHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { FinancialHighlights } from "../financial-highlights";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("FinancialHighlights", () => {
  it("renders the pending label when a metric has no value", () => {
    const { container } = render(
      <FinancialHighlights heading="Financial highlights" metrics={[{ label: "Net sales", unit: "million yen" }]} />,
    );
    expect(getByText(container, "Net sales")).toBeInTheDocument();
    expect(getByText(container, /Updated at earnings release/)).toBeInTheDocument();
  });

  it("renders the value and unit when set", () => {
    const { container } = render(
      <FinancialHighlights
        heading="Financial highlights"
        metrics={[{ label: "Net sales", unit: "million yen", value: "82,340" }]}
      />,
    );
    expect(getByText(container, "82,340")).toBeInTheDocument();
    expect(getByText(container, "million yen")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    const { container } = render(
      <FinancialHighlights heading="Financial highlights" metrics={[{ label: "Net sales", unit: "million yen" }]} bare />,
    );
    expect(queryHeading(container, "Financial highlights")).not.toBeInTheDocument();
  });
});
