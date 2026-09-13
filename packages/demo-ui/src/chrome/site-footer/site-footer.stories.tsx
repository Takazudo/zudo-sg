import type { StoryMeta, Story } from "../../stories/types";
import { SiteFooter, type SiteFooterProps } from "./site-footer";
import type { NavSection } from "../site-nav/site-nav";

const meta: StoryMeta = {
  title: "SiteFooter",
  category: "Navigation",
  description: "Sitemap-style footer: one auto-fit column per nav section, its children as links, plus a copyright + policy-link row.",
  usage: `import { SiteFooter } from "@zudo-sg/ui";

<SiteFooter sections={sections} />`,
};

export default meta;

const MOCK_SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [
      { label: "About", href: "/company/about", slug: "company/about", order: 1 },
      { label: "Company profile", href: "/company/profile", slug: "company/profile", order: 2 },
      { label: "History", href: "/company/history", slug: "company/history", order: 3 },
    ],
  },
  {
    label: "Products",
    href: "/products",
    order: 2,
    children: [
      { label: "Electronic devices", href: "/products/electronic-devices", slug: "products/electronic-devices", order: 1 },
      { label: "Chemicals", href: "/products/chemical", slug: "products/chemical", order: 2 },
    ],
  },
  {
    label: "Sustainability",
    href: "/sustainability",
    order: 3,
    children: [
      { label: "Environment", href: "/sustainability/environment", slug: "sustainability/environment", order: 1 },
      { label: "Governance", href: "/sustainability/governance", slug: "sustainability/governance", order: 2 },
    ],
  },
  {
    label: "News",
    order: 4,
    children: [{ label: "Press releases", href: "/ir/announce", slug: "ir/announce", order: 1 }],
  },
  {
    label: "Careers",
    href: "/recruit",
    order: 5,
    children: [{ label: "Open positions", href: "/recruit/career", slug: "recruit/career", order: 1 }],
  },
];

const POLICY_LINKS = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Site policy", href: "/sitepolicy" },
  { label: "Code of conduct", href: "/company/governance" },
];

export const Default: Story<SiteFooterProps> = {
  name: "Default",
  source: `<SiteFooter sections={sections} policyLinks={policyLinks} />`,
  render: () => <SiteFooter sections={MOCK_SECTIONS} policyLinks={POLICY_LINKS} />,
};

export const FewSections: Story<SiteFooterProps> = {
  name: "Few sections",
  source: `<SiteFooter sections={sections.slice(0, 2)} />`,
  render: () => <SiteFooter sections={MOCK_SECTIONS.slice(0, 2)} />,
};

export const ManySections: Story<SiteFooterProps> = {
  name: "Many sections (wrapping columns)",
  source: `<SiteFooter sections={[...sections, extraSection]} />`,
  render: () => (
    <SiteFooter
      sections={[
        ...MOCK_SECTIONS,
        {
          label: "Investor relations",
          href: "/ir",
          order: 6,
          children: [
            { label: "Highlights", href: "/ir/highlights", slug: "ir/highlights", order: 1 },
            { label: "Stock information", href: "/ir/stock", slug: "ir/stock", order: 2 },
            { label: "Notices", href: "/ir/notice", slug: "ir/notice", order: 3 },
          ],
        },
      ]}
    />
  ),
};
