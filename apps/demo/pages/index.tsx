import DefaultLayout from "../layouts/default";
import { Container } from "@zudo-sg/ui/src/shared/container/container.tsx";
import { LandingHero } from "@zudo-sg/ui/src/landing/landing-hero/landing-hero.tsx";
import { NewsTeaser } from "@zudo-sg/ui/src/news/news-teaser/news-teaser.tsx";
import { StatBand, type BandStat } from "@zudo-sg/ui/src/landing/stat-band/stat-band.tsx";
import { FeatureSplit, type FeatureSplitPillar } from "@zudo-sg/ui/src/landing/feature-split/feature-split.tsx";
import { BusinessSegments } from "@zudo-sg/ui/src/landing/business-segments/business-segments.tsx";
import { DiscoveryTeaser, type DiscoveryScene } from "@zudo-sg/ui/src/landing/discovery-teaser/discovery-teaser.tsx";
import { BusinessLinePortal } from "@zudo-sg/ui/src/landing/business-line-portal/business-line-portal.tsx";
import { SdgsHighlight, type SdgsInitiative } from "@zudo-sg/ui/src/landing/sdgs-highlight/sdgs-highlight.tsx";
import { RecruitBand } from "@zudo-sg/ui/src/landing/recruit-band/recruit-band.tsx";
import { SectionNav, type SectionNavLink } from "@zudo-sg/ui/src/landing/section-nav/section-nav.tsx";

import { getNews } from "../lib/news";
import { BUSINESS_SEGMENTS } from "../config/segments";
import { BUSINESS_LINE_LIST } from "../config/lines";

export const frontmatter = {
  title: "Home",
  description: "An English-language sample site for a fictional business.",
};

// This landing page's own copy — heading/lead/scene/initiative text below —
// is fictional dummy corporate content matching the ported content
// collection's language (see apps/demo/content/); it is not real business
// data.

const HERO_ACTIONS = [
  { label: "Products", href: "/products", variant: "primary" as const },
  { label: "Company", href: "/company", variant: "secondary" as const },
];

const STATS: BandStat[] = [
  { value: "—", unit: "", label: "Sample founding date" },
  { value: "—", unit: "", label: "Sample capital" },
  { value: "—", unit: "", label: "Sample team size" },
  { value: "4", unit: "", label: "Sample business areas" },
];

const FEATURE_PILLARS: [FeatureSplitPillar, FeatureSplitPillar] = [
  {
    index: "01",
    title: "Reliable foundations",
    body: "A fictional business begins with clear priorities, useful tools, and room to learn.",
  },
  {
    index: "02",
    title: "A practical example",
    body: "This sample content demonstrates how a concise story can support a product-focused layout.",
  },
];

const DISCOVERY_SCENES: DiscoveryScene[] = [
  {
    title: "Mobility",
    body: "Sample components support clear, connected travel experiences.",
  },
  {
    title: "Schools",
    body: "Sample tools make space for flexible, collaborative learning.",
  },
  {
    title: "Hospitals",
    body: "Sample systems illustrate dependable support for care environments.",
  },
  {
    title: "Solar power",
    body: "Sample equipment helps explain an efficient energy workflow.",
  },
];

const SDGS_INITIATIVES: SdgsInitiative[] = [
  {
    title: "Thoughtful product design",
    body: "This fictional initiative shows how a business might consider products over their full life cycle.",
  },
  {
    title: "Efficient operations",
    body: "This fictional initiative demonstrates practical choices for everyday operations.",
  },
  {
    title: "Community partnerships",
    body: "This fictional initiative illustrates collaboration with local communities.",
  },
];

// Recruiting is consolidated in RecruitBand below, so the site-wide section
// nav omits its own recruiting card (the component itself stays reusable —
// only the links passed here are trimmed).
const SECTION_NAV_LINKS: SectionNavLink[] = [
  {
    title: "Company",
    sub: "Company",
    body: "Learn about this fictional business, its purpose, and its sample company profile.",
    href: "/company",
  },
  {
    title: "Products",
    sub: "Products",
    body: "Explore fictional products, components, equipment, and chemical solutions.",
    href: "/products",
  },
  {
    title: "Sustainability",
    sub: "Sustainability",
    body: "See sample approaches to environmental, social, and governance priorities.",
    href: "/sustainability",
  },
  {
    title: "Investor relations",
    sub: "IR",
    body: "Browse fictional investor updates, financial materials, and reference documents.",
    href: "/ir",
  },
  {
    title: "Contact us",
    sub: "Contact",
    body: "Find the right sample contact path for products, careers, or investor questions.",
    href: "/contact",
  },
];

/**
 * Landing page (`/`) — composed entirely from `@zudo-sg/ui`'s ported landing
 * components (#230), with dummy copy/data matching the ported content
 * collection (#233). `BusinessLinePortal` reuses `config/lines.ts`
 * (BUSINESS_LINE_LIST) and `BusinessSegments` reuses `config/segments.ts`
 * (BUSINESS_SEGMENTS) — the same registries `_mdx-content-sections.tsx`
 * derives from for the MDX-registered variants — so the landing page and the
 * content pages it links to can't drift apart on labels/hrefs.
 */
export default function HomePage() {
  const newsItems = getNews({ limit: 4 });
  const irNewsItems = getNews({ category: "IR", limit: 3 });
  const segments = BUSINESS_SEGMENTS.map((s) => ({ title: s.title, body: s.summary, href: s.href }));
  const lines = BUSINESS_LINE_LIST.map((line) => ({
    key: line.key,
    label: line.label,
    description: line.description,
    href: line.homeHref,
  }));

  return (
    <DefaultLayout>
      <LandingHero
        eyebrow="Dummy Tagline"
        heading={
          <>
            Ideas for <span class="text-accent">better</span>
            <br class="max-sm:hidden" />
            {" "}business
          </>
        }
        lead="This fictional demo shows how a focused business site can introduce products, people, and long-term priorities."
        actions={HERO_ACTIONS}
      />

      <Container class="py-vsp-lg">
        <NewsTeaser heading="News" items={newsItems} viewAllHref="/news" viewAllLabel="View all" />
      </Container>

      <section class="border-y border-border bg-surface py-vsp-lg">
        <Container>
          <NewsTeaser heading="Investor news" items={irNewsItems} viewAllHref="/ir/news" viewAllLabel="View all" />
        </Container>
      </section>

      <Container class="py-vsp-lg">
        <StatBand stats={STATS} />
      </Container>

      <Container class="pb-vsp-2xl">
        <FeatureSplit
          eyebrow="Dummy Tagline"
          heading="Reliable foundations"
          lead="Clear information and practical details help a fictional business tell a useful story."
          pillars={FEATURE_PILLARS}
        />
      </Container>

      <section class="border-y border-border bg-surface py-vsp-2xl">
        <Container>
          <BusinessSegments heading="Product categories" intro="Explore a fictional product portfolio arranged around clear, familiar business needs." segments={segments} />
        </Container>
      </section>

      <Container class="py-vsp-2xl">
        <DiscoveryTeaser
          heading="Where we help"
          intro="Fictional products and services can support everyday places, from schools to energy sites."
          scenes={DISCOVERY_SCENES}
          href="/company/discovery"
          linkLabel="View all sample scenes"
        />
      </Container>

      <section class="border-y border-border bg-surface py-vsp-2xl">
        <Container>
          <BusinessLinePortal
            heading="Business lines"
            intro="Five fictional business lines show how the same content system can adapt to distinct audiences."
            lines={lines}
          />
        </Container>
      </section>

      <Container class="py-vsp-2xl">
        <SdgsHighlight
          eyebrow="Sustainability"
          heading="Building a sustainable future"
          lead="This fictional program uses simple examples to show how sustainability content can be organized clearly."
          initiatives={SDGS_INITIATIVES}
          href="/sustainability/sdgs"
          linkLabel="Explore sustainability"
        />
      </Container>

      <RecruitBand
        eyebrow="Recruit"
        heading="Build the next sample with us"
        lead="Explore fictional graduate and experienced-hire paths designed to demonstrate a clear careers journey."
        href="/recruit"
        ctaLabel="Explore careers"
      />

      <Container class="py-vsp-2xl">
        <SectionNav heading="Explore the site" links={SECTION_NAV_LINKS} />
      </Container>
    </DefaultLayout>
  );
}
