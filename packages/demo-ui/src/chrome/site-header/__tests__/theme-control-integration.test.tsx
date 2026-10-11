import { afterEach, describe, expect, it } from "vitest";
import { fire, flushAll, renderIsland } from "../../../test-utils/zudo-react.js";
import { ThemeControl } from "../../../shared/theme-control/theme-control";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "../../../shared/theme-control/theme-state";
import { SiteNav, type NavSection } from "../../site-nav/site-nav";
import { SiteHeader } from "../site-header";

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [{ label: "About", href: "/company/about", slug: "company/about", order: 1 }],
  },
];

function DesktopThemeFixture() {
  return <SiteHeader sections={SECTIONS} desktopThemeControl={<ThemeControl />} />;
}

function MobileThemeFixture() {
  return <SiteNav sections={SECTIONS} mobileThemeControl={<ThemeControl />} />;
}

afterEach(() => {
  document.documentElement.dataset.theme = DEFAULT_THEME;
  localStorage.removeItem(THEME_STORAGE_KEY);
});

describe("chrome theme-control integration", () => {
  it("uses the same root selection and storage key in both breakpoint slots", async () => {
    const desktop = renderIsland(DesktopThemeFixture, {});
    fire(desktop.container.querySelector('[data-theme-control="desktop"] button') as HTMLElement, "click");
    await flushAll();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    desktop.dispose();

    const mobile = renderIsland(MobileThemeFixture, {});
    await mobile.flush();
    const mobileControl = mobile.container.querySelector('[data-theme-control="mobile"] button') as HTMLElement;
    expect(mobileControl.getAttribute("aria-pressed")).toBe("true");
    fire(mobileControl, "click");
    await flushAll();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
