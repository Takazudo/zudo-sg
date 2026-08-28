import type { StoryMeta, Story } from "../../stories/types";
import { NewsList, type NewsItem } from "./news-list";

const meta: StoryMeta = {
  title: "NewsList",
  category: "News",
  description:
    "Shared 'date / category badge / title' feed row for a news index or IR-news page. `items` is supplied by the caller (no content-layer dependency).",
  usage: `import { NewsList } from "@zudo-sg/ui";

<NewsList heading="News" items={items} />`,
  order: 1,
};

export default meta;

const MOCK_NEWS: NewsItem[] = [
  { date: "2026-06-19", category: "Sustainability", title: "Sample news item 1", slug: "news/sample-01" },
  { date: "2026-06-18", category: "Exhibitions", title: "Sample news item 2", slug: "news/sample-02" },
  { date: "2026-06-12", category: "Sustainability", title: "Sample news item 3", slug: "news/sample-03" },
  { date: "2026-05-29", category: "Corporate", title: "Sample news item 4", slug: "news/sample-04" },
  {
    date: "2026-05-08",
    category: "Products",
    title: "Sample news item 5 (external link)",
    slug: "news/sample-05",
    href: "https://example.com/news/",
  },
  { date: "2026-04-01", category: "IR", title: "Sample news item 6", slug: "news/sample-06" },
];

export const Default: Story = {
  name: "Default (all items)",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <NewsList heading="News" items={MOCK_NEWS} />
    </div>
  ),
};

export const LimitedThree: Story = {
  name: "Limited (top 3)",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <NewsList items={MOCK_NEWS.slice(0, 3)} />
    </div>
  ),
};

export const IROnly: Story = {
  name: "IR only",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <NewsList heading="IR News" items={MOCK_NEWS.filter((n) => n.category === "IR")} />
    </div>
  ),
};

export const WithFilter: Story = {
  name: "With filter bar",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <NewsList heading="News" showFilter items={MOCK_NEWS} />
    </div>
  ),
};

export const Empty: Story = {
  name: "Empty",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <NewsList heading="News" items={[]} />
    </div>
  ),
};
