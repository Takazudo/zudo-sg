import type { StoryMeta, Story } from "../../stories/types";
import { SearchResults, type SearchResultsProps } from "./search-results";
import type { SearchDoc } from "../search-doc";

const meta: StoryMeta = {
  title: "SearchResults",
  category: "Search",
  description:
    "SSR-rendered cross-site search results list. Renders a full, correct list from `docs`/`query` alone — the companion `SearchResultsEnhancer` island (see its own story) adds live client-side filtering on top.",
  usage: `import { SearchResults } from "@zudo-sg/ui/src/search/search-results/search-results";

<SearchResults docs={docs} query="" />`,
  order: 1,
};

export default meta;

const SAMPLE_DOCS: SearchDoc[] = [
  {
    title: "About us",
    href: "/about",
    section: "Company",
    description: "Our mission, history, and the team behind the product.",
    excerpt: "",
  },
  {
    title: "Pricing",
    href: "/pricing",
    section: "Product",
    description: "Plans and pricing for teams of every size.",
    excerpt: "",
  },
  {
    title: "Getting started guide",
    href: "/docs/getting-started",
    section: "Docs",
    description: "",
    excerpt: "Install the CLI, connect your first project, and ship your first change in minutes.",
  },
  {
    title: "Careers",
    href: "/careers",
    section: "",
    description: "",
    excerpt: "",
  },
];

export const Default: Story<SearchResultsProps> = {
  name: "Default (no query)",
  source: `<SearchResults docs={docs} query="" />`,
  render: () => <SearchResults docs={SAMPLE_DOCS} query="" />,
};

export const WithQuery: Story<SearchResultsProps> = {
  name: "With query",
  source: `<SearchResults docs={docs} query="docs" />`,
  render: () => <SearchResults docs={SAMPLE_DOCS} query="docs" />,
};

export const NoResults: Story<SearchResultsProps> = {
  name: "No results",
  source: `<SearchResults docs={docs} query="nonexistent" />`,
  render: () => <SearchResults docs={SAMPLE_DOCS} query="nonexistent" />,
};
