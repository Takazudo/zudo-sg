import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseOl } from "../prose-ol";

describe("ProseOl", () => {
  it("renders a decimal-numbered list", () => {
    render(
      <ProseOl>
        <li>Step one</li>
      </ProseOl>,
    );
    const el = screen.getByText("Step one").parentElement as HTMLElement;
    expect(el.tagName).toBe("OL");
    expect(el.className).toContain("list-decimal");
  });
});
