import type { StoryMeta, Story } from "../../stories/types";
import { NewsTeaser } from "./news-teaser";
import type { NewsItem } from "../news-list/news-list";

const meta: StoryMeta = {
  title: "NewsTeaser",
  category: "News",
  description:
    "Landing-page 'News'/'IR News' excerpt band: a heading row with a 'view all' link, over NewsList's latest N rows (unfiltered). One component serves both feeds via `items`.",
  usage: `import { NewsTeaser } from "@zudo-sg/ui";

<NewsTeaser heading="News" items={items} viewAllHref="/news" />`,
  order: 3,
};

export default meta;

const MOCK_NEWS: NewsItem[] = [
  { date: "2026-06-19", category: "Sustainability", title: "Received a diversity certification", slug: "news/diversity-cert-2026" },
  { date: "2026-06-18", category: "Exhibitions", title: "Exhibiting at Tech Expo West 2026", slug: "news/tech-expo-west-2026" },
  { date: "2026-06-12", category: "Sustainability", title: "Received a childcare-support certification", slug: "news/childcare-cert-2026" },
  { date: "2026-05-12", category: "IR", title: "FY2026 full-year earnings announcement", slug: "news/ir-q4-2026" },
];

const MOCK_IR: NewsItem[] = [
  { date: "2026-05-12", category: "IR", title: "FY2026 full-year earnings announcement", slug: "news/ir-q4-2026" },
  { date: "2026-02-10", category: "IR", title: "FY2026 Q3 earnings announcement", slug: "news/ir-q3-2026" },
  { date: "2025-06-20", category: "IR", title: "Notice regarding dividends", slug: "news/ir-dividend-2025" },
];

export const News: Story = {
  name: "News (all categories)",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <NewsTeaser heading="News" items={MOCK_NEWS} viewAllHref="/news" />
    </div>
  ),
};

export const IRNews: Story = {
  name: "IR News",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <NewsTeaser heading="IR News" items={MOCK_IR} viewAllHref="/ir/news" />
    </div>
  ),
};

export const Narrow: Story = {
  name: "Narrow (heading row stacks)",
  render: () => (
    <div style={{ maxWidth: "380px" }}>
      <NewsTeaser heading="News" items={MOCK_NEWS} viewAllHref="/news" />
    </div>
  ),
};
