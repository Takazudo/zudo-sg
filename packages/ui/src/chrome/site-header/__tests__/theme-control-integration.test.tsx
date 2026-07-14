import { fireEvent, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
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

afterEach(() => {
  document.documentElement.dataset.theme = DEFAULT_THEME;
  localStorage.removeItem(THEME_STORAGE_KEY);
});

describe("chrome theme-control integration", () => {
  it("uses the same root selection and storage key when the visible breakpoint control changes", () => {
    const desktop = render(<SiteHeader sections={SECTIONS} desktopThemeControl={<ThemeControl />} />);
    fireEvent.click(document.querySelector('[data-theme-control="desktop"] button') as HTMLButtonElement);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    desktop.unmount();

    render(<SiteNav sections={SECTIONS} mobileThemeControl={<ThemeControl />} />);
    const mobileControl = document.querySelector('[data-theme-control="mobile"] button') as HTMLButtonElement;
    expect(mobileControl).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(mobileControl);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
