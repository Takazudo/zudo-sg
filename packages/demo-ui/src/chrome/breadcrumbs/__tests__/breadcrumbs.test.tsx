import { describe, expect, it } from "vitest";
import { getByRole, getByText, renderIsland, renderSsr } from "../../../test-utils/zudo-react.js";
import { Breadcrumbs } from "../breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders nothing for a single (home-only) crumb", () => {
    expect(renderSsr(<Breadcrumbs crumbs={[{ label: "Home", href: "/" }]} />)).toBe("");
  });

  it("renders every crumb but the last as a link", () => {
    const app = renderIsland(Breadcrumbs, {
      crumbs: [
        { label: "Home", href: "/" },
        { label: "Company", href: "/company" },
        { label: "Profile" },
      ],
    });

    expect(getByRole(app.container, "link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(getByRole(app.container, "link", { name: "Company" }).getAttribute("href")).toBe("/company");
  });

  it("renders the last crumb as non-link text with aria-current=page", () => {
    const app = renderIsland(Breadcrumbs, {
      crumbs: [{ label: "Home", href: "/" }, { label: "Profile" }],
    });
    const current = getByText(app.container, "Profile");

    expect(current.tagName).toBe("SPAN");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("renders a middle crumb with no href as non-link text and no aria-current", () => {
    const app = renderIsland(Breadcrumbs, {
      crumbs: [{ label: "Home", href: "/" }, { label: "Unlisted section" }, { label: "Page" }],
    });
    const middle = getByText(app.container, "Unlisted section");

    expect(middle.tagName).toBe("SPAN");
    expect(middle.hasAttribute("aria-current")).toBe(false);
  });
});
