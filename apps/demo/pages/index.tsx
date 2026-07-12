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
  description: "ダミー株式会社（Dummy Co., Ltd.）の企業サイト — 会社情報・製品・サステナビリティ・IR情報をご紹介します。",
};

// This landing page's own copy — heading/lead/scene/initiative text below —
// is fictional dummy corporate content matching the ported content
// collection's language (see apps/demo/content/); it is not real business
// data.

const HERO_ACTIONS = [
  { label: "ダミー分類", href: "/products", variant: "primary" as const },
  { label: "企業情報", href: "/company", variant: "secondary" as const },
];

const STATS: BandStat[] = [
  { value: "1953", unit: "年", label: "設立（昭和28年11月）" },
  { value: "約81", unit: "億円", label: "資本金" },
  { value: "約1,500", unit: "名", label: "連結従業員数" },
  { value: "4", unit: "区分", label: "事業領域" },
];

const FEATURE_PILLARS: [FeatureSplitPillar, FeatureSplitPillar] = [
  {
    index: "01",
    title: "ダミー見出し",
    body: "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
  },
  {
    index: "02",
    title: "サンプルタイトル",
    body: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。誰がこんな夜更けに、しかもこんな街灯のお粗末な港街の狭い小道で彼をつけて来るというのだ。人生の航路を捻じ曲げ、その獲物と共に立ち去ろうとしている、その丁度今。彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。",
  },
];

const DISCOVERY_SCENES: DiscoveryScene[] = [
  {
    title: "車",
    body: "LiDAR 用光学フィルタや画像処理 LSI、ToF センサが、先進運転支援と快適なカーライフを支えます。",
  },
  {
    title: "学校",
    body: "カメラモジュールやインタラクティブホワイトボードが、教育のデジタル化と学びの場を支えます。",
  },
  {
    title: "病院",
    body: "医療機器に組み込まれるダミー区分1や、衛生環境を保つケミカル製品が、医療の現場を支えます。",
  },
  {
    title: "太陽光発電",
    body: "パワーデバイスやパワーコンディショナ向け部品が、再生可能エネルギーの安定運用を支えます。",
  },
];

const SDGS_INITIATIVES: SdgsInitiative[] = [
  {
    title: "環境配慮型製品の開発・販売",
    body: "気候変動対応や資源循環に貢献する製品ラインナップを拡充し、環境配慮型ビジネスを推進します。",
  },
  {
    title: "資源・エネルギーの有効活用",
    body: "国内5拠点の太陽光発電や LED 照明化、社有車の低公害車化でエネルギー効率を高めます。",
  },
  {
    title: "社会に貢献する活動の推進",
    body: "障がいのある方の雇用推進や森林ボランティア活動など、地域・社会と連携した貢献を続けます。",
  },
];

// Recruiting is consolidated in RecruitBand below, so the site-wide section
// nav omits its own recruiting card (the component itself stays reusable —
// only the links passed here are trimmed).
const SECTION_NAV_LINKS: SectionNavLink[] = [
  {
    title: "企業情報",
    sub: "Company",
    body: "ダミーのあゆみ・経営理念・会社概要。複合企業としての姿をご紹介します。",
    href: "/company",
  },
  {
    title: "ダミー分類",
    sub: "Products",
    body: "ダミー区分1・ダミー区分2・電子機器・ダミーの 4 領域。",
    href: "/products",
  },
  {
    title: "サステナビリティ",
    sub: "Sustainability",
    body: "事業を通じた社会課題の解決と、持続可能な未来への取り組み。",
    href: "/sustainability",
  },
  {
    title: "IR情報",
    sub: "IR",
    body: "株主・投資家の皆さまへ。業績・決算・IR ライブラリをご案内します。",
    href: "/ir",
  },
  {
    title: "お問い合わせ",
    sub: "Contact",
    body: "製品・取引・採用・IR など、各種お問い合わせはこちらから。",
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
            ダミー<span class="text-accent">×</span>サンプル見出しで
            <br class="max-sm:hidden" />
            これはダミーの見出しです
          </>
        }
        lead="彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。誰がこんな夜更けに、しかもこんな街灯のお粗末な港街の狭い小道で彼をつけて来るというのだ。人生の航路を捻じ曲げ、その獲物と共に立ち去ろうとしている、その丁度今。彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。それとも背後の足音の主は、この街に無数にいる法監視役で、強靭な罰をすぐにも彼の手首にガシャンと下すというのか。"
        actions={HERO_ACTIONS}
      />

      <Container class="py-vsp-lg">
        <NewsTeaser heading="お知らせ" items={newsItems} viewAllHref="/news" viewAllLabel="すべて見る" />
      </Container>

      <section class="border-y border-border bg-surface py-vsp-lg">
        <Container>
          <NewsTeaser heading="IRニュース" items={irNewsItems} viewAllHref="/ir/news" viewAllLabel="すべて見る" />
        </Container>
      </section>

      <Container class="py-vsp-lg">
        <StatBand stats={STATS} />
      </Container>

      <Container class="pb-vsp-2xl">
        <FeatureSplit
          eyebrow="Dummy Tagline"
          heading="ダミー見出し"
          lead="彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。それとも背後の足音の主は、この街に無数にいる法監視役で、強靭な罰をすぐにも彼の手首にガシャンと下すというのか。"
          pillars={FEATURE_PILLARS}
        />
      </Container>

      <section class="border-y border-border bg-surface py-vsp-2xl">
        <Container>
          <BusinessSegments heading="ダミー見出し" intro="あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。" segments={segments} />
        </Container>
      </section>

      <Container class="py-vsp-2xl">
        <DiscoveryTeaser
          heading="こんなところにダミー"
          intro="暮らしや社会のさまざまな場所で、ダミーのダミー区分1・ダミー区分2・電子電気機器・ダミーが活躍しています。"
          scenes={DISCOVERY_SCENES}
          href="/company/discovery"
          linkLabel="すべてのシーンを見る"
        />
      </Container>

      <section class="border-y border-border bg-surface py-vsp-2xl">
        <Container>
          <BusinessLinePortal
            heading="事業ライン一覧"
            intro="5 つの事業ラインで、幅広い分野に価値を届けています。"
            lines={lines}
          />
        </Container>
      </section>

      <Container class="py-vsp-2xl">
        <SdgsHighlight
          eyebrow="Sustainability"
          heading="持続可能な未来への取り組み"
          lead="「人と技術と自然環境の共生」というビジョンのもと、事業を通じて環境・社会・経済の持続可能な発展に貢献します。"
          initiatives={SDGS_INITIATIVES}
          href="/sustainability/sdgs"
          linkLabel="SDGsへの取り組みを見る"
        />
      </Container>

      <RecruitBand
        eyebrow="Recruit"
        heading="未来をつくる仲間を募集しています"
        lead="エレクトロニクスとケミカル、二つの力で社会の課題に挑む。新卒・キャリア採用の情報とエントリーは、採用情報ページでご案内しています。"
        href="/recruit"
        ctaLabel="採用情報を見る"
      />

      <Container class="py-vsp-2xl">
        <SectionNav heading="サイト案内" links={SECTION_NAV_LINKS} />
      </Container>
    </DefaultLayout>
  );
}
