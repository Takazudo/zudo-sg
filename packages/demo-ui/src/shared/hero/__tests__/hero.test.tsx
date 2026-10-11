import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { Hero } from "../hero";

afterEach(disposeAll);

describe("Hero", () => {
  it("renders the heading as an <h1>", () => {
    const { container } = renderIsland(function Fixture() {
      return <Hero heading="Build things that last" />;
    }, {});
    const el = container.querySelector("h1")!;
    expect(el).toHaveTextContent("Build things that last");
  });

  it("renders the eyebrow and lead when provided", () => {
    const { container } = renderIsland(function Fixture() {
      return <Hero eyebrow="Welcome" heading="Title" lead="A lead paragraph." />;
    }, {});
    expect(getByText(container, "Welcome")).toBeInTheDocument();
    expect(getByText(container, "A lead paragraph.")).toBeInTheDocument();
  });

  it("renders one CTA link per action", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <Hero
          heading="Title"
          actions={[
            { label: "Primary", href: "/a", variant: "primary" },
            { label: "Secondary", href: "/b", variant: "secondary" },
          ]}
        />
      );
    }, {});
    expect(getByRole(container, "link", { name: /Primary/ })).toHaveAttribute("href", "/a");
    expect(getByRole(container, "link", { name: /Secondary/ })).toHaveAttribute("href", "/b");
  });

  it("applies the secondary variant's heading max-width", () => {
    const { container } = renderIsland(function Fixture() {
      return <Hero heading="Title" variant="secondary" />;
    }, {});
    expect(container.querySelector("h1")!.classList.contains("max-w-[24ch]")).toBe(true);
  });
});
