import type { StoryMeta, Story } from "../../stories/types";
import { SectionNav, type SectionNavProps, type SectionNavLink } from "./section-nav";

const meta: StoryMeta = {
  title: "SectionNav",
  category: "Landing",
  description:
    "Grid of navigation cards teasing a site's top-level sections, each with a short description and an internal- or external-link affordance.",
  usage: `import { SectionNav } from "@zudo-sg/ui/src/landing/section-nav/section-nav";

<SectionNav heading="Explore the site" links={links} />`,
  order: 8,
};

export default meta;

const LINKS: SectionNavLink[] = [
  { title: "Company", sub: "Company", body: "Our history, mission, and corporate profile.", href: "/company" },
  { title: "Products", sub: "Products", body: "Four business segments spanning electronics and chemicals.", href: "/products" },
  { title: "Sustainability", sub: "Sustainability", body: "How we contribute to a sustainable future.", href: "/sustainability" },
  { title: "IR", sub: "IR", body: "Financial results and investor materials.", href: "/ir" },
  { title: "Recruit", sub: "Recruit", body: "Open roles and life at our company.", href: "/recruit" },
  { title: "Contact", sub: "Contact", body: "Get in touch with our team.", href: "/contact" },
];

export const Default: Story<SectionNavProps> = {
  name: "Default (6 sections)",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <SectionNav heading="Explore the site" links={LINKS} />
    </div>
  ),
};

export const WithExternalLink: Story<SectionNavProps> = {
  name: "With an external link",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <SectionNav
        heading="Main menu"
        links={[
          { title: "Company", sub: "Company", body: "Our history and corporate profile.", href: "/company" },
          { title: "Products", sub: "Products", body: "Four business segments.", href: "/products" },
          {
            title: "Recruit",
            sub: "Recruit",
            body: "Our recruiting site is hosted on a separate domain.",
            href: "https://www.example-recruit.com/",
            external: true,
          },
        ]}
      />
    </div>
  ),
};
