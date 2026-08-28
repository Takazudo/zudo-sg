import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseA } from "../prose-a";

describe("ProseA", () => {
  it("renders a link with its href and children", () => {
    render(<ProseA href="/docs">Read the docs</ProseA>);
    const link = screen.getByRole("link", { name: "Read the docs" });
    expect(link).toHaveAttribute("href", "/docs");
    expect(link.className).toContain("text-accent");
  });

  it("skips prose link styling for hash-link anchors", () => {
    render(
      <ProseA href="#section" class="hash-link">
        #
      </ProseA>,
    );
    const link = screen.getByRole("link", { name: "#" });
    expect(link.className).toBe("hash-link");
  });
});
