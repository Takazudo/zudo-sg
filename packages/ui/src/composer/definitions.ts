// Temporary package-internal collection for the in-repository Composer.
// External consumers use the public pack added in issue #476, not this path.
import { calloutComposer } from "../cards/callout/callout.composer";
import { cardComposer } from "../cards/card/card.composer";
import { proseMdComposer } from "../content/prose-md/prose-md.composer";
import { prosePComposer } from "../content/prose-p/prose-p.composer";
import { placeholderBoxComposer } from "../media/placeholder-box/placeholder-box.composer";
import { autoGridComposer } from "../shared/auto-grid/auto-grid.composer";
import { containerComposer } from "../shared/container/container.composer";
import { ctaButtonComposer } from "../shared/cta-button/cta-button.composer";
import { heroComposer } from "../shared/hero/hero.composer";
import { sectionHeadingComposer } from "../shared/section-heading/section-heading.composer";
import { splitLayoutComposer } from "../shared/split-layout/split-layout.composer";
import { stackComposer } from "../shared/stack/stack.composer";

export const componentDefinitions = [
  autoGridComposer,
  calloutComposer,
  cardComposer,
  containerComposer,
  ctaButtonComposer,
  heroComposer,
  placeholderBoxComposer,
  proseMdComposer,
  prosePComposer,
  sectionHeadingComposer,
  splitLayoutComposer,
  stackComposer,
] as const;
