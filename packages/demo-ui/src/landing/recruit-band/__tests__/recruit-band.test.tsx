import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { getHeading } from "../../test-utils";
import type { Child } from "@takazudo/zfb/zudo-react";
import { RecruitBand } from "../recruit-band";

afterEach(disposeAll);

function render(node: Child) {
  return renderIsland(function Fixture() {
    return node;
  }, {});
}

describe("RecruitBand", () => {
  it("renders the heading, lead, and CTA link", () => {
    const { container } = render(
      <RecruitBand
        heading="Build the future with us"
        lead="A demo lead paragraph."
        href="/recruit"
      />,
    );
    expect(getHeading(container, "Build the future with us")).toBeInTheDocument();
    expect(getByText(container, "A demo lead paragraph.")).toBeInTheDocument();
    expect(getByRole(container, "link", { name: /View openings/ })).toHaveAttribute("href", "/recruit");
  });

  it("uses a custom CTA label when provided", () => {
    const { container } = render(<RecruitBand heading="Join us" href="/recruit" ctaLabel="See open roles" />);
    expect(getByRole(container, "link", { name: /See open roles/ })).toBeInTheDocument();
  });
});
