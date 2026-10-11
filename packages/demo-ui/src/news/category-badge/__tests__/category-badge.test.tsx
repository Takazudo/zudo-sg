import { describe, expect, it } from "vitest";
import { getByText, renderIsland } from "../../../test-utils/zudo-react.js";
import { CategoryBadge } from "../category-badge";

describe("CategoryBadge", () => {
  it("renders the category label", () => {
    const app = renderIsland(CategoryBadge, { category: "IR" });

    expect(getByText(app.container, "IR")).toBeTruthy();
  });

  it("falls back to the neutral tone for an unregistered category", () => {
    const app = renderIsland(CategoryBadge, { category: "Recruiting" });
    const badge = getByText(app.container, "Recruiting");

    expect(badge.classList.contains("text-muted")).toBe(true);
  });

  it("uses the accent tone for a registered category", () => {
    const app = renderIsland(CategoryBadge, { category: "IR" });
    const badge = getByText(app.container, "IR");

    expect(badge.classList.contains("text-accent")).toBe(true);
  });
});
