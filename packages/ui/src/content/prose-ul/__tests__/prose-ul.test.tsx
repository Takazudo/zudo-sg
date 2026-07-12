import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseUl } from "../prose-ul";

describe("ProseUl", () => {
  it("renders a disc-marked list", () => {
    render(
      <ProseUl>
        <li>Item one</li>
      </ProseUl>,
    );
    const el = screen.getByText("Item one").parentElement as HTMLElement;
    expect(el.tagName).toBe("UL");
    expect(el.className).toContain("list-disc");
  });
});
