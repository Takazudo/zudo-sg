import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseLi } from "../prose-li";

describe("ProseLi", () => {
  it("renders an li with the muted-marker styling", () => {
    render(
      <ul>
        <ProseLi>Item one</ProseLi>
      </ul>,
    );
    const el = screen.getByText("Item one");
    expect(el.tagName).toBe("LI");
    expect(el.className).toContain("marker:text-muted");
  });
});
