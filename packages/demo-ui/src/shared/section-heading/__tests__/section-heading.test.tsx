import { renderIsland, disposeAll, getByText, queryByText } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { SectionHeading } from "../section-heading";

afterEach(disposeAll);

describe("SectionHeading", () => {
  it("renders the heading as an <h2> by default", () => {
    const { container } = renderIsland(function Fixture() {
      return <SectionHeading heading="Product lines" />;
    }, {});
    const el = container.querySelector("h2")!;
    expect(el).toHaveTextContent("Product lines");
  });

  it("renders as h1 when as='h1'", () => {
    const { container } = renderIsland(function Fixture() {
      return <SectionHeading heading="Product lines" as="h1" />;
    }, {});
    expect(container.querySelector("h1")!).toHaveTextContent("Product lines");
  });

  it("renders the eyebrow and intro when provided", () => {
    const { container } = renderIsland(function Fixture() {
      return <SectionHeading eyebrow="Sustainability" heading="Title" intro="Intro copy." />;
    }, {});
    expect(getByText(container, "Sustainability")).toBeInTheDocument();
    expect(getByText(container, "Intro copy.")).toBeInTheDocument();
  });

  it("omits the intro paragraph when not provided", () => {
    const { container } = renderIsland(function Fixture() {
      return <SectionHeading heading="Title" />;
    }, {});
    expect(queryByText(container, "Intro copy.")).not.toBeInTheDocument();
  });
});
