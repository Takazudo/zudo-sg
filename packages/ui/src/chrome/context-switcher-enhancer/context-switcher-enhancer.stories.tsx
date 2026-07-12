import type { ComponentChildren } from "preact";
import type { StoryMeta, Story } from "../../stories/types";
import { SiteHeader, type BrandSwitcherItem } from "../site-header/site-header";
import ContextSwitcherEnhancer from "./context-switcher-enhancer";

const meta: StoryMeta = {
  title: "ContextSwitcherEnhancer",
  category: "Navigation",
  description:
    "Render-null a11y island for SiteHeader's business-context switcher panel: syncs aria-expanded, adds click-to-pin, and Escape/outside-click to close. The panel already opens on hover/focus via pure CSS — mount this alongside SiteHeader (via the consumer's own Island with ssrFallback={null}) to layer the enhancement on top.",
  usage: `import { SiteHeader } from "@zudo-sg/ui";
import ContextSwitcherEnhancer from "@zudo-sg/ui/src/chrome/context-switcher-enhancer/context-switcher-enhancer";

<SiteHeader switcherItems={switcherItems} />
<Island when="visible" ssrFallback={null}><ContextSwitcherEnhancer /></Island>`,
};

export default meta;

const SWITCHER_ITEMS: BrandSwitcherItem[] = [
  { key: "corporate", label: "Corporate", href: "/", mark: "○", description: "Sample corporate tagline.", domain: "acme.example", current: true },
  { key: "vacuum", label: "Line A", href: "/lines/vacuum", mark: "A", description: "One-line pitch for business line A.", domain: "line-a.example", current: false },
];

function HeaderFrame({ children }: { children: ComponentChildren }) {
  return (
    <div style={{ position: "relative", minHeight: "20rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      {children}
      <p style={{ margin: "var(--spacing-vsp-sm) var(--spacing-hsp-xl)", fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>
        Click the "Viewing …" pill to pin the panel open, click outside (or press Escape) to close.
      </p>
    </div>
  );
}

export const Default: Story = {
  name: "Click to pin, Escape/outside-click to close",
  source: `<SiteHeader switcherItems={switcherItems} />
<ContextSwitcherEnhancer />`,
  render: () => (
    <HeaderFrame>
      <SiteHeader switcherItems={SWITCHER_ITEMS} />
      <ContextSwitcherEnhancer />
    </HeaderFrame>
  ),
};
