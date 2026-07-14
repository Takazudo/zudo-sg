import type { ComponentChildren } from "preact";
import type { StoryMeta, Story } from "../../stories/types";
import type { NavSection } from "../site-nav/site-nav";
import { SiteHeader } from "../site-header/site-header";
import ContextSwitcherEnhancer from "./context-switcher-enhancer";

const meta: StoryMeta = {
  title: "ContextSwitcherEnhancer",
  category: "Navigation",
  description:
    "Render-null a11y island for SiteHeader's Browse category walk: syncs aria-expanded, adds click-to-pin, and Escape/outside-click to close. The panel already opens on hover/focus via pure CSS.",
  usage: `import { SiteHeader } from "@zudo-sg/ui";
import ContextSwitcherEnhancer from "@zudo-sg/ui/src/chrome/context-switcher-enhancer/context-switcher-enhancer";

<SiteHeader sections={sections} />
<Island when="visible" ssrFallback={null}><ContextSwitcherEnhancer /></Island>`,
};

export default meta;

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [{ label: "About", href: "/company/about", slug: "company/about", order: 1 }],
  },
  {
    label: "Products",
    href: "/products",
    order: 2,
    children: [{ label: "Components", href: "/products/components", slug: "products/components", order: 1 }],
  },
];

function HeaderFrame({ children }: { children: ComponentChildren }) {
  return (
    <div style={{ position: "relative", minHeight: "20rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      {children}
      <p style={{ margin: "var(--spacing-vsp-sm) var(--spacing-hsp-xl)", fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>
        Click Browse to pin the category walk open, click outside (or press Escape) to close.
      </p>
    </div>
  );
}

export const Default: Story = {
  name: "Click to pin, Escape/outside-click to close",
  source: `<SiteHeader sections={sections} />
<ContextSwitcherEnhancer />`,
  render: () => (
    <HeaderFrame>
      <SiteHeader sections={SECTIONS} />
      <ContextSwitcherEnhancer />
    </HeaderFrame>
  ),
};
