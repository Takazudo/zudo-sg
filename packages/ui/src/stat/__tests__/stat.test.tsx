import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Stat, StatGroup } from "../stat";

describe("Stat", () => {
  it("renders the value and label", () => {
    render(<Stat value="42" label="Downloads" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Downloads")).toBeInTheDocument();
  });

  it("renders the hint only when provided", () => {
    const { rerender } = render(<Stat value="42" label="Downloads" hint="Since launch" />);
    expect(screen.getByText("Since launch")).toBeInTheDocument();

    rerender(<Stat value="42" label="Downloads" />);
    expect(screen.queryByText("Since launch")).not.toBeInTheDocument();
  });

  it("merges a caller-supplied class onto the wrapper", () => {
    const { container } = render(<Stat value="42" label="Downloads" class="custom-x" />);
    expect(container.firstElementChild?.className).toContain("custom-x");
  });
});

describe("StatGroup", () => {
  it("renders its children", () => {
    render(
      <StatGroup>
        <Stat value="1" label="One" />
        <Stat value="2" label="Two" />
      </StatGroup>,
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("does not add divider classes by default", () => {
    const { container } = render(
      <StatGroup>
        <Stat value="1" label="One" />
      </StatGroup>,
    );
    expect(container.firstElementChild?.className).not.toContain("divide-x");
  });

  it("adds divider classes when divided=true", () => {
    const { container } = render(
      <StatGroup divided>
        <Stat value="1" label="One" />
      </StatGroup>,
    );
    expect(container.firstElementChild?.className).toContain("divide-x");
  });

  it("merges a caller-supplied class onto the wrapper", () => {
    const { container } = render(
      <StatGroup class="custom-x">
        <Stat value="1" label="One" />
      </StatGroup>,
    );
    expect(container.firstElementChild?.className).toContain("custom-x");
  });
});
