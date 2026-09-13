import type { StoryMeta, Story } from "../../stories/types";
import { CategoryBadge, type CategoryBadgeProps } from "./category-badge";

const meta: StoryMeta = {
  title: "CategoryBadge",
  category: "News",
  description:
    "Small colored pill for a news item's category, derived from the accent token via color-mix (no dedicated per-category palette).",
  usage: `import { CategoryBadge } from "@zudo-sg/ui";

<CategoryBadge category="IR" />`,
  order: 1,
};

export default meta;

const CATEGORIES = ["Corporate", "Products", "Sustainability", "Exhibitions", "IR"];

export const AllCategories: Story<CategoryBadgeProps> = {
  name: "All categories",
  source: CATEGORIES.map((c) => `<CategoryBadge category="${c}" />`).join("\n"),
  render: () => (
    <div class="flex flex-wrap gap-hsp-sm">
      {CATEGORIES.map((c) => (
        <CategoryBadge key={c} category={c} />
      ))}
    </div>
  ),
};

export const UnknownFallback: Story<CategoryBadgeProps> = {
  name: "Unknown category (neutral fallback)",
  source: `<CategoryBadge category="IR" />\n<CategoryBadge category="Recruiting" />`,
  render: () => (
    <div class="flex flex-wrap gap-hsp-sm">
      <CategoryBadge category="IR" />
      <CategoryBadge category="Recruiting" />
    </div>
  ),
};
