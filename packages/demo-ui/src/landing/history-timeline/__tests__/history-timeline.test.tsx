import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText } from "../../../test-utils/zudo-react";
import type { Child } from "@takazudo/zfb/zudo-react";
import { HistoryTimeline } from "../history-timeline";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("HistoryTimeline", () => {
  it("renders each entry's year and event as a list item", () => {
    const { container } = render(
      <HistoryTimeline
        entries={[
          { year: "1953", event: "Company founded." },
          { year: "2022", event: "Listed on the Prime Market." },
        ]}
      />,
    );
    const items = Array.from(container.querySelectorAll("li"));
    expect(items).toHaveLength(2);
    expect(getByText(container, "1953")).toBeInTheDocument();
    expect(getByText(container, "Company founded.")).toBeInTheDocument();
    expect(getByText(container, "2022")).toBeInTheDocument();
  });
});
