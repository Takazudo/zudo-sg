import type { StoryMeta, Story } from "../../stories/types";
import { SiteNav, type NavSection } from "../site-nav/site-nav";
import MobileNavEnhancer from "./mobile-nav-enhancer";

const meta: StoryMeta = {
  title: "MobileNavEnhancer",
  category: "Navigation",
  description:
    "Render-null a11y island for SiteNav's off-canvas drawer: syncs the toggle checkbox's aria-expanded/label, adds a focus trap + body scroll-lock while open, and Escape-to-close. The drawer opens/closes with no JS via a checkbox hack — mount this alongside SiteNav (via the consumer's own Island with ssrFallback={null}) to layer the enhancement on top. Resize the preview below 640px to see the drawer/hamburger.",
  usage: `import { SiteNav } from "@zudo-sg/ui";
import MobileNavEnhancer from "@zudo-sg/ui/src/chrome/mobile-nav-enhancer/mobile-nav-enhancer";

<SiteNav sections={sections} />
<Island when="visible" ssrFallback={null}><MobileNavEnhancer /></Island>`,
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
    order: 2,
    children: [{ label: "Electronic devices", href: "/products/electronic-devices", slug: "products/electronic-devices", order: 1 }],
  },
];

export const Default: Story = {
  name: "Open the drawer via the hamburger",
  source: `<SiteNav sections={sections} />
<MobileNavEnhancer />`,
  render: () => (
    <div style={{ position: "relative", height: "360px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <SiteNav sections={SECTIONS} />
      <MobileNavEnhancer />
    </div>
  ),
};
