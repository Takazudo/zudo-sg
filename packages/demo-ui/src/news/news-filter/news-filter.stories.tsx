import type { StoryMeta, Story } from "../../stories/types";
import { NewsFilter } from "./news-filter";

const meta: StoryMeta = {
  title: "NewsFilter",
  category: "News",
  description:
    "Category-filter button group for a news feed (progressive enhancement — see the component's JSDoc). This preview shows the static button states only; filtering behavior needs both a NewsList's rows in the same section and the paired NewsFilterEnhancer island mounted — see NewsList's \"With filter bar\" story for the full picture in a real app with the island running.",
  usage: `import { NewsFilter } from "@zudo-sg/ui";

<NewsFilter categories={["Corporate", "IR"]} />`,
  order: 2,
};

export default meta;

const CATEGORIES = ["Corporate", "Products", "Sustainability", "Exhibitions", "IR"];

export const Default: Story = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <NewsFilter categories={CATEGORIES} />
    </div>
  ),
};

export const FewCategories: Story = {
  name: "Few categories",
  render: () => (
    <div style={{ maxWidth: "480px" }}>
      <NewsFilter categories={["Corporate", "IR"]} />
    </div>
  ),
};
