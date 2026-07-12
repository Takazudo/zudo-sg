import type { ComponentChildren } from "preact";
import type { StoryMeta, Story } from "../../stories/types";
import { SiteNav, type SiteNavProps, type NavSection } from "./site-nav";

const meta: StoryMeta = {
  title: "SiteNav",
  category: "Navigation",
  description:
    "Fixed left global nav rail: sections expand inline via native <details>/<summary> (no JS required); collapses to an off-canvas drawer below `sm`.",
  usage: `import { SiteNav } from "@zudo-sg/ui";

<SiteNav sections={sections} currentSlug={currentSlug} />`,
};

export default meta;

const MOCK_SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [
      { label: "About", href: "/company/about", slug: "company/about", order: 1 },
      { label: "Message from the CEO", href: "/company/message", slug: "company/message", order: 2 },
      { label: "Company profile", href: "/company/profile", slug: "company/profile", order: 3 },
      { label: "History", href: "/company/history", slug: "company/history", order: 4 },
      { label: "Group companies", href: "/company/group", slug: "company/group", order: 5 },
    ],
  },
  {
    label: "Products",
    href: "/products",
    order: 2,
    children: [
      { label: "Electronic devices", href: "/products/electronic-devices", slug: "products/electronic-devices", order: 1 },
      { label: "Chemicals", href: "/products/chemical", slug: "products/chemical", order: 2 },
      { label: "Components", href: "/products/components", slug: "products/components", order: 3 },
      { label: "Equipment", href: "/products/equipment", slug: "products/equipment", order: 4 },
    ],
  },
  {
    label: "Sustainability",
    href: "/sustainability",
    order: 3,
    children: [
      { label: "Environment", href: "/sustainability/environment", slug: "sustainability/environment", order: 1 },
      { label: "Governance", href: "/sustainability/governance", slug: "sustainability/governance", order: 2 },
      { label: "Society", href: "/sustainability/social", slug: "sustainability/social", order: 3 },
    ],
  },
  {
    label: "News",
    order: 4,
    children: [
      { label: "IR news", href: "/ir/news", slug: "ir/news", order: 1 },
      { label: "Press releases", href: "/ir/announce", slug: "ir/announce", order: 2 },
    ],
  },
  {
    label: "Careers",
    href: "/recruit",
    order: 5,
    children: [
      { label: "New graduates", href: "/recruit/new-graduate", slug: "recruit/new-graduate", order: 1 },
      { label: "Experienced hires", href: "/recruit/career", slug: "recruit/career", order: 2 },
    ],
  },
];

/** SiteNav is fixed-position, so stories confine it inside a relatively-positioned frame. */
function NavFrame({ children }: { children: ComponentChildren }) {
  return (
    <div
      style={{ position: "relative", height: "560px", width: "14rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}
      class="zui-nav-story-frame"
    >
      <style>{`
        /* Story-only: pin SiteNav's fixed rail to this frame instead of the viewport. */
        .zui-nav-story-frame nav[aria-label="Global navigation"] { position: absolute; }
      `}</style>
      {children}
    </div>
  );
}

export const Default: Story<SiteNavProps> = {
  name: "Default",
  source: `<SiteNav sections={sections} />`,
  render: () => (
    <NavFrame>
      <SiteNav sections={MOCK_SECTIONS} />
    </NavFrame>
  ),
};

export const ActiveSection: Story<SiteNavProps> = {
  name: "Active section",
  source: `<SiteNav sections={sections} currentSlug="company/profile" />`,
  render: () => (
    <NavFrame>
      <SiteNav sections={MOCK_SECTIONS} currentSlug="company/profile" />
    </NavFrame>
  ),
};

export const SectionWithoutTopLink: Story<SiteNavProps> = {
  name: "Section without a top link",
  source: `<SiteNav sections={sections} />`,
  render: () => {
    const sections: NavSection[] = [
      {
        label: "No top link",
        order: 1,
        children: [
          { label: "Child page A", href: "/x/a", slug: "x/a", order: 1 },
          { label: "Child page B", href: "/x/b", slug: "x/b", order: 2 },
        ],
      },
      MOCK_SECTIONS[0] as NavSection,
    ];
    return (
      <NavFrame>
        <SiteNav sections={sections} />
      </NavFrame>
    );
  },
};

export const ManySections: Story<SiteNavProps> = {
  name: "Many sections (scrolling rail)",
  source: `<SiteNav sections={[...sections, extraSection]} />`,
  render: () => (
    <NavFrame>
      <SiteNav
        sections={[
          ...MOCK_SECTIONS,
          {
            label: "Investor relations",
            href: "/ir",
            order: 6,
            children: [
              { label: "Highlights", href: "/ir/highlights", slug: "ir/highlights", order: 1 },
              { label: "Stock information", href: "/ir/stock", slug: "ir/stock", order: 2 },
            ],
          },
        ]}
      />
    </NavFrame>
  ),
};
