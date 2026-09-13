import type { StoryMeta, Story } from "../../stories/types";
import SearchResultsEnhancer from "./search-results-enhancer";
import { SearchResults } from "../search-results/search-results";
import type { SearchDoc } from "../search-doc";

const meta: StoryMeta = {
  title: "SearchResultsEnhancer",
  category: "Search",
  description:
    "Render-null progressive-enhancement island for SearchResults. Renders nothing itself — on mount it live-filters the result list as the user types and keeps `?q=` in the URL in sync, by attaching behavior to the `data-search-*` hooks SearchResults already renders.",
  usage: `import { Island } from "@takazudo/zfb";
import { SearchResults } from "@zudo-sg/ui/src/search/search-results/search-results";
import SearchResultsEnhancer from "@zudo-sg/ui/src/search/search-results-enhancer/search-results-enhancer";

<SearchResults docs={docs} query="" />
<Island when="visible" ssrFallback={null}>
  <SearchResultsEnhancer />
</Island>`,
  order: 2,
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
];

// Renders SearchResults + the enhancer together (no <Island> wrapper needed in
// the catalog's live preview iframe — the enhancer just needs the data-*
// hooks present in the same document to bind to). Type in the box to see the
// list/count filter live and `?q=` sync into the iframe's URL.
export const Live: Story = {
  name: "Live (type to filter)",
  source: `<SearchResults docs={docs} query="" />
<SearchResultsEnhancer />`,
  render: () => (
    <div>
      <SearchResults docs={SAMPLE_DOCS} query="" />
      <SearchResultsEnhancer />
    </div>
  ),
};
