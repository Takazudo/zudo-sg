import type { ComponentChildren } from "preact";
import type { StoryMeta, Story } from "../../stories/types";
import { SiteNav, type NavSection } from "../site-nav/site-nav";
import NavEnhancer from "./nav-enhancer";

const meta: StoryMeta = {
  title: "NavEnhancer",
  category: "Navigation",
  description:
    "Render-null a11y island for SiteNav's <details>/<summary> accordion: syncs aria-expanded on toggle and closes the focused section on Escape. The accordion itself works with no JS — mount this alongside SiteNav (via the consumer's own Island with ssrFallback={null}) to layer the enhancement on top.",
  usage: `import { SiteNav } from "@zudo-sg/ui";
import NavEnhancer from "@zudo-sg/ui/src/chrome/nav-enhancer/nav-enhancer";

<SiteNav sections={sections} />
<Island when="visible" ssrFallback={null}><NavEnhancer /></Island>`,
};

export default meta;

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [
      { label: "About", href: "/company/about", slug: "company/about", order: 1 },
      { label: "Company profile", href: "/company/profile", slug: "company/profile", order: 2 },
    ],
  },
  {
    label: "Products",
    order: 2,
    children: [
      { label: "Electronic devices", href: "/products/electronic-devices", slug: "products/electronic-devices", order: 1 },
      { label: "Chemicals", href: "/products/chemical", slug: "products/chemical", order: 2 },
    ],
  },
];

function NavFrame({ children }: { children: ComponentChildren }) {
  return (
    <div
      style={{ position: "relative", height: "360px", width: "14rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}
      class="zui-nav-story-frame"
    >
      <style>{`.zui-nav-story-frame nav[aria-label="Global navigation"] { position: absolute; }`}</style>
      {children}
    </div>
  );
}

export const Default: Story = {
  name: "Click a section, then press Escape",
  source: `<SiteNav sections={sections} />
<NavEnhancer />`,
  render: () => (
    <NavFrame>
      <SiteNav sections={SECTIONS} />
      <NavEnhancer />
    </NavFrame>
  ),
};
