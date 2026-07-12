import type { ComponentChildren } from "preact";
import type { StoryMeta, Story } from "../../stories/types";
import { SiteHeader, type BrandSwitcherItem } from "../site-header/site-header";
import SearchToggleEnhancer from "./search-toggle-enhancer";

const meta: StoryMeta = {
  title: "SearchToggleEnhancer",
  category: "Navigation",
  description:
    "Render-null a11y island for SiteHeader's search toggle: syncs aria-expanded to real focus-within state, focuses the input on click/tap, and Escape collapses it. The input already expands on focus-within via pure CSS — mount this alongside SiteHeader (via the consumer's own Island with ssrFallback={null}) to layer the enhancement on top.",
  usage: `import { SiteHeader } from "@zudo-sg/ui";
import SearchToggleEnhancer from "@zudo-sg/ui/src/chrome/search-toggle-enhancer/search-toggle-enhancer";

<SiteHeader switcherItems={switcherItems} />
<Island when="visible" ssrFallback={null}><SearchToggleEnhancer /></Island>`,
};

export default meta;

const SWITCHER_ITEMS: BrandSwitcherItem[] = [
  { key: "corporate", label: "Corporate", href: "/", mark: "○", description: "Sample corporate tagline.", domain: "acme.example", current: true },
];

function HeaderFrame({ children }: { children: ComponentChildren }) {
  return (
    <div style={{ position: "relative", minHeight: "8rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      {children}
      <p style={{ margin: "var(--spacing-vsp-sm) var(--spacing-hsp-xl)", fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>
        Click the search icon (⌕) to focus the input, press Escape to collapse it again.
      </p>
    </div>
  );
}

export const Default: Story = {
  name: "Click to focus, Escape to collapse",
  source: `<SiteHeader switcherItems={switcherItems} />
<SearchToggleEnhancer />`,
  render: () => (
    <HeaderFrame>
      <SiteHeader switcherItems={SWITCHER_ITEMS} />
      <SearchToggleEnhancer />
    </HeaderFrame>
  ),
};
