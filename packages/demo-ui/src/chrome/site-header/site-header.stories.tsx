import type { ComponentChildren } from "preact";
import type { StoryMeta, Story } from "../../stories/types";
import { ThemeControl } from "../../shared/theme-control/theme-control";
import type { NavSection } from "../site-nav/site-nav";
import { SiteHeader, type SiteHeaderProps } from "./site-header";

const meta: StoryMeta = {
  title: "SiteHeader",
  category: "Navigation",
  description:
    "Full-width sticky desktop header: brand lockup, a real section-tree Browse disclosure, theme control, and utility navigation.",
  usage: `import { SiteHeader } from "@zudo-sg/ui";

<SiteHeader sections={sections} desktopThemeControl={<ThemeControl />} />`,
};

export default meta;

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [
      { label: "About", href: "/company/about", slug: "company/about", order: 1 },
      { label: "Leadership", href: "/company/leadership", slug: "company/leadership", order: 2 },
      { label: "Locations", href: "/company/locations", slug: "company/locations", order: 3 },
    ],
  },
  {
    label: "Products",
    href: "/products",
    order: 2,
    children: [
      { label: "Electronic devices", href: "/products/electronic-devices", slug: "products/electronic-devices", order: 1 },
      { label: "Components", href: "/products/components", slug: "products/components", order: 2 },
    ],
  },
  {
    label: "Sustainability",
    href: "/sustainability",
    order: 3,
    children: [{ label: "Environment", href: "/sustainability/environment", slug: "sustainability/environment", order: 1 }],
  },
];

/** The header's panel drops below it, so stories use a tall bordered frame. */
function HeaderFrame({ children }: { children: ComponentChildren }) {
  return (
    <div style={{ position: "relative", minHeight: "22rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      {children}
      <p style={{ margin: "var(--spacing-vsp-sm) var(--spacing-hsp-xl)", fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>
        Hover the Browse button, or Tab from it through the section destinations, to open the no-JavaScript category walk.
      </p>
    </div>
  );
}

export const CategoryWalk: Story<SiteHeaderProps> = {
  name: "Category walk",
  source: `<SiteHeader sections={sections} desktopThemeControl={<ThemeControl />} />`,
  render: () => (
    <HeaderFrame>
      <SiteHeader sections={SECTIONS} desktopThemeControl={<ThemeControl />} />
    </HeaderFrame>
  ),
};

export const EmptyTree: Story<SiteHeaderProps> = {
  name: "No sections",
  source: `<SiteHeader sections={[]} desktopThemeControl={<ThemeControl />} />`,
  render: () => (
    <HeaderFrame>
      <SiteHeader sections={[]} desktopThemeControl={<ThemeControl />} />
    </HeaderFrame>
  ),
};
