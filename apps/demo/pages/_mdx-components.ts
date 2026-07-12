/**
 * Explicit MDX component map. zfb ignores `import` statements written inside
 * MDX content — every custom tag content uses must be registered here or
 * the build fails with a 500 on that page.
 *
 * Registered tags (every custom caps-tag the content collection uses):
 *   img              → PlaceholderBox (no real image assets exist — see
 *                       its own doc for why: ~100 image references are
 *                       deliberately backing-file-less placeholders).
 *   Card / CardGrid  → flat surface card + its responsive grid wrapper.
 *   Callout / Note   → note/aside box; `Note` is the `tone="note"` alias.
 *   LineHero         → shared business-line landing hero (5 lines).
 *   NewsList         → live news-feed row list (see _mdx-content-sections.tsx
 *                       — derives `items` from lib/news.ts's getNews()).
 *   ContactForm / RecruitEntryForm → mock inquiry/recruiting forms (their
 *                       *-form-enhancer islands are mounted unconditionally
 *                       in pages/[...slug].tsx — harmless no-ops on pages
 *                       without the form's DOM hooks).
 *   CompanyProfileTable / HistoryTimeline / LocationList / GroupCompanyGrid /
 *   ProductCategoryGrid / StrengthList / BusinessLinePortal /
 *   FinancialHighlights / CertList / InitiativeGrid / ValuePillars →
 *       bound section components (own fixed dummy dataset each — see
 *       _mdx-content-sections.tsx's header doc for why the data lives there
 *       rather than inline in content).
 *   h2-h6 / p / a / strong / em / ul / ol / li / blockquote / table / th /
 *   td / dl / dt / dd → Prose* typography overrides (@zudo-sg/ui/src/content).
 *       `defaultComponents` (spread below) only covers h2-h4/p/a/strong/
 *       blockquote/ul/ol/table/code — the Prose* overrides here take
 *       precedence for every one of those plus the tags it doesn't cover
 *       (em/li/dl/dt/dd/th/td). `code`/`pre`/`hr` are left as zfb's built-in
 *       passthrough — no Prose override exists for them.
 */
import { defaultComponents } from "@takazudo/zfb";
import type { MdxComponents } from "@takazudo/zfb";

import { PlaceholderBox } from "@zudo-sg/ui/src/media/placeholder-box/placeholder-box.tsx";
import { Card } from "@zudo-sg/ui/src/cards/card/card.tsx";
import { CardGrid } from "@zudo-sg/ui/src/cards/card-grid/card-grid.tsx";
import { Callout, Note } from "@zudo-sg/ui/src/cards/callout/callout.tsx";
import { LineHero } from "@zudo-sg/ui/src/landing/line-hero/line-hero.tsx";
import { ContactForm } from "@zudo-sg/ui/src/forms/contact-form/contact-form.tsx";
import { RecruitEntryForm } from "@zudo-sg/ui/src/forms/recruit-entry-form/recruit-entry-form.tsx";

import {
  CompanyProfileTable,
  HistoryTimeline,
  LocationList,
  GroupCompanyGrid,
  ProductCategoryGrid,
  StrengthList,
  BusinessLinePortal,
  FinancialHighlights,
  CertList,
  InitiativeGrid,
  ValuePillars,
  NewsList,
} from "./_mdx-content-sections";

import { ProseH2 } from "@zudo-sg/ui/src/content/prose-h2/prose-h2.tsx";
import { ProseH3 } from "@zudo-sg/ui/src/content/prose-h3/prose-h3.tsx";
import { ProseH4 } from "@zudo-sg/ui/src/content/prose-h4/prose-h4.tsx";
import { ProseH5 } from "@zudo-sg/ui/src/content/prose-h5/prose-h5.tsx";
import { ProseH6 } from "@zudo-sg/ui/src/content/prose-h6/prose-h6.tsx";
import { ProseP } from "@zudo-sg/ui/src/content/prose-p/prose-p.tsx";
import { ProseA } from "@zudo-sg/ui/src/content/prose-a/prose-a.tsx";
import { ProseStrong } from "@zudo-sg/ui/src/content/prose-strong/prose-strong.tsx";
import { ProseEm } from "@zudo-sg/ui/src/content/prose-em/prose-em.tsx";
import { ProseUl } from "@zudo-sg/ui/src/content/prose-ul/prose-ul.tsx";
import { ProseOl } from "@zudo-sg/ui/src/content/prose-ol/prose-ol.tsx";
import { ProseLi } from "@zudo-sg/ui/src/content/prose-li/prose-li.tsx";
import { ProseBlockquote } from "@zudo-sg/ui/src/content/prose-blockquote/prose-blockquote.tsx";
import { ProseTable, ProseTh, ProseTd } from "@zudo-sg/ui/src/content/prose-table/prose-table.tsx";
import { ProseDl, ProseDt, ProseDd } from "@zudo-sg/ui/src/content/prose-dl/prose-dl.tsx";

export const mdxComponents: MdxComponents = {
  ...defaultComponents,

  img: PlaceholderBox,

  Card,
  CardGrid,
  Callout,
  Note,

  LineHero,

  NewsList,

  ContactForm,
  RecruitEntryForm,

  CompanyProfileTable,
  HistoryTimeline,
  LocationList,
  GroupCompanyGrid,
  ProductCategoryGrid,
  StrengthList,
  BusinessLinePortal,
  FinancialHighlights,
  CertList,
  InitiativeGrid,
  ValuePillars,

  h2: ProseH2,
  h3: ProseH3,
  h4: ProseH4,
  h5: ProseH5,
  h6: ProseH6,
  p: ProseP,
  a: ProseA,
  strong: ProseStrong,
  em: ProseEm,
  ul: ProseUl,
  ol: ProseOl,
  li: ProseLi,
  blockquote: ProseBlockquote,
  table: ProseTable,
  th: ProseTh,
  td: ProseTd,
  dl: ProseDl,
  dt: ProseDt,
  dd: ProseDd,
};
