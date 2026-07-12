import type { ComponentChildren } from "preact";
import type { StoryMeta, Story } from "../../stories/types";
import { SiteHeader, type SiteHeaderProps, type BrandSwitcherItem } from "./site-header";

const meta: StoryMeta = {
  title: "SiteHeader",
  category: "Navigation",
  description:
    "Full-width sticky global header: brand lockup, business-context switcher (pure-CSS mega-panel), and utility nav.",
  usage: `import { SiteHeader } from "@zudo-sg/ui";

<SiteHeader switcherItems={switcherItems} />`,
};

export default meta;

const CORPORATE: BrandSwitcherItem = {
  key: "corporate",
  label: "Corporate",
  href: "/",
  mark: "○",
  description: "Sample corporate tagline goes here.",
  domain: "acme.example",
  current: true,
};

// Keys match the `--palette-line-<key>-*` rungs in styles/colors.css (see
// TOKEN-MAP.md §2) so `data-line="vacuum"` below resolves against real
// tokens — labels stay generic (this batch doesn't own the demo's business
// content, only the chrome that will one day render it).
const LINES: BrandSwitcherItem[] = [
  {
    key: "vacuum",
    label: "Line A",
    href: "/lines/vacuum",
    mark: "A",
    description: "One-line pitch for business line A.",
    domain: "line-a.example",
    current: false,
  },
  {
    key: "process",
    label: "Line B",
    href: "/lines/process",
    mark: "B",
    description: "One-line pitch for business line B.",
    domain: "line-b.example",
    current: false,
  },
  {
    key: "laser",
    label: "Line C",
    href: "/lines/laser",
    mark: "C",
    description: "One-line pitch for business line C.",
    domain: "line-c.example",
    current: false,
  },
];

function withCurrent(key: string): BrandSwitcherItem[] {
  return [CORPORATE, ...LINES].map((item) => ({ ...item, current: item.key === key }));
}

/** The header is `width:100%` and its panel drops below it, so stories wrap it in a tall bordered frame. */
function HeaderFrame({ children }: { children: ComponentChildren }) {
  return (
    <div style={{ position: "relative", minHeight: "22rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      {children}
      <p style={{ margin: "var(--spacing-vsp-sm) var(--spacing-hsp-xl)", fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>
        Hover the "Viewing …" pill, or Tab into it, to open the context panel (pure CSS — no JS required).
      </p>
    </div>
  );
}

export const CorporateContext: Story<SiteHeaderProps> = {
  name: "Corporate context",
  source: `<SiteHeader switcherItems={switcherItems} />`,
  render: () => (
    <HeaderFrame>
      <SiteHeader switcherItems={withCurrent("corporate")} />
    </HeaderFrame>
  ),
};

export const LineContext: Story<SiteHeaderProps> = {
  name: "Business-line context",
  source: `<div data-line="vacuum">
  <SiteHeader switcherItems={switcherItems} />
</div>`,
  render: () => (
    <div data-line="vacuum">
      <HeaderFrame>
        <SiteHeader switcherItems={withCurrent("vacuum")} />
      </HeaderFrame>
    </div>
  ),
};
